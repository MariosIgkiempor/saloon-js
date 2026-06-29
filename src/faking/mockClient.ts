// Port of ../saloon/src/Http/Faking/MockClient.php
//
// `createMockClient` records sends and resolves the next fake for a pending request.
// Matching priority (PHP's `guessNextResponse`): request name → connector name →
// URL pattern → ordered sequence. Keyed entries are reusable; only the sequence is
// consumed one at a time. Identity keys are `name` strings or factory functions
// (matched by `fn.name`) — see api-style.md (mock matching keys off `name`, not a
// class). Assertions throw plain `Error`s so they work under any test runner.

import type { MockClient, MockValue, RecordedResponse, SentMatcher } from '@/contracts/MockClient';
import type { Response } from '@/contracts/Response';
import type { PendingRequest } from '@/http/pendingRequest';

interface KeyedEntry {
  key: unknown;
  value: MockValue;
}

export function createMockClient(mockData?: Map<unknown, MockValue> | MockValue[]): MockClient {
  const keyed: KeyedEntry[] = [];
  const sequence: MockValue[] = [];
  const recorded: RecordedResponse[] = [];

  const client: MockClient = {
    addResponses(responses) {
      if (responses instanceof Map) {
        for (const [key, value] of responses) keyed.push({ key, value });
      } else {
        for (const value of responses) sequence.push(value);
      }
      return client;
    },
    addResponse(response, key) {
      if (key === undefined) sequence.push(response);
      else keyed.push({ key, value: response });
      return client;
    },
    guessNextResponse(pending) {
      const requestName = pending.getRequest().name;
      const connectorName = pending.getConnector().name;
      const url = pending.url;

      for (const entry of keyed) if (keyMatchesName(entry.key, requestName)) return entry.value;
      for (const entry of keyed) if (keyMatchesName(entry.key, connectorName)) return entry.value;
      for (const entry of keyed) {
        if (typeof entry.key === 'string' && urlMatches(entry.key, url)) return entry.value;
      }

      const next = sequence.shift();
      if (next) return next;
      throw new Error(`Saloon mock: no response defined for ${pending.method} ${url}`);
    },
    recordResponse(pending, response) {
      recorded.push({ pendingRequest: pending, request: pending.getRequest(), response });
    },
    getRecordedResponses: () => [...recorded],
    getLastRequest: () => recorded.at(-1)?.request,
    getLastPendingRequest: () => recorded.at(-1)?.pendingRequest,
    getLastResponse: () => recorded.at(-1)?.response,
    assertSent(target) {
      const matcher = buildMatcher(target);
      if (!recorded.some(matcher)) {
        throw new Error(
          `Saloon mock: expected a matching request to have been sent, but none of the ${recorded.length} recorded request(s) matched.`,
        );
      }
    },
    assertNotSent(target) {
      const matcher = buildMatcher(target);
      if (recorded.some(matcher)) {
        throw new Error('Saloon mock: expected no matching request, but one was sent.');
      }
    },
    assertSentCount(count, target) {
      const matcher = target !== undefined ? buildMatcher(target) : () => true;
      const actual = recorded.filter(matcher).length;
      if (actual !== count) {
        throw new Error(
          `Saloon mock: expected ${count} matching request(s), but ${actual} were sent.`,
        );
      }
    },
    assertNothingSent() {
      if (recorded.length > 0) {
        throw new Error(
          `Saloon mock: expected nothing sent, but ${recorded.length} request(s) were.`,
        );
      }
    },
    assertSentInOrder(targets) {
      if (targets.length > recorded.length) {
        throw new Error(
          `Saloon mock: expected ${targets.length} request(s) in order, but only ${recorded.length} were sent.`,
        );
      }
      for (const [index, target] of targets.entries()) {
        const record = recorded[index];
        if (!record || !buildMatcher(target)(record)) {
          throw new Error(`Saloon mock: request #${index + 1} did not match the expected order.`);
        }
      }
    },
    findResponseByRequest(target, index = 0) {
      return recorded.filter(buildMatcher(target)).at(index)?.response;
    },
    findResponseByRequestUrl(url, index = 0) {
      return recorded.filter(buildMatcher(url)).at(index)?.response;
    },
  };

  if (mockData) client.addResponses(mockData);
  return client;
}

// --- A process-global mock client, for setting one mock per test file ----------

let globalMockClient: MockClient | undefined;

export function setGlobalMockClient(client: MockClient): void {
  globalMockClient = client;
}

export function getGlobalMockClient(): MockClient | undefined {
  return globalMockClient;
}

export function destroyGlobalMockClient(): void {
  globalMockClient = undefined;
}

// --- Matching helpers ----------------------------------------------------------

function keyMatchesName(key: unknown, name: string | undefined): boolean {
  if (!name) return false;
  if (typeof key === 'string') return key === name;
  if (typeof key === 'function') return key.name === name;
  return false;
}

/**
 * PHP `URLHelper::matches`: `Str::is(Str::start($pattern, '*'), $value)`. Every
 * pattern is implicitly prefixed with `*` (collapsing any existing leading `*`s),
 * so the host-relative idiom `'github.com/*'` matches a full `https://…` URL.
 * `*` then matches any run of characters (including `/`).
 */
export function urlMatches(pattern: string, url: string): boolean {
  const prefixed = `*${pattern.replace(/^\*+/, '')}`;
  if (prefixed === url) return true;
  const regex = new RegExp(`^${prefixed.split('*').map(escapeRegExp).join('.*')}$`);
  return regex.test(url);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nameMatches(name: string, record: RecordedResponse): boolean {
  return record.request.name === name || record.pendingRequest.getConnector().name === name;
}

// A string target is a name or URL pattern; a function of arity ≥ 2 is a predicate
// `(pending, response) => boolean`; any other function is a factory matched by name.
function buildMatcher(target: SentMatcher): (record: RecordedResponse) => boolean {
  if (typeof target === 'string') {
    return (record) => nameMatches(target, record) || urlMatches(target, record.pendingRequest.url);
  }
  if (typeof target === 'function') {
    if (target.length >= 2) {
      const predicate = target as (pending: PendingRequest, response: Response) => unknown;
      return (record) => Boolean(predicate(record.pendingRequest, record.response));
    }
    return (record) => nameMatches(target.name, record);
  }
  return () => false;
}

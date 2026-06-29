import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MockValue } from '@/contracts/MockClient';
import { Method } from '@/enums';
import { createMockClient } from '@/faking/mockClient';
import { mockResponse } from '@/faking/mockResponse';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { createFetchSender } from '@/http/senders/fetchSender';

/** A fetch double that stamps the (fake) clock when it is finally invoked. */
function stampingFetch(stamp: { at: number | null }): typeof fetch {
  return (async () => {
    stamp.at = Date.now();
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

describe('delay middleware', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits the configured delay before sending', async () => {
    vi.useFakeTimers();
    const stamp: { at: number | null } = { at: null };
    const connector = defineConnector({
      baseUrl: 'https://example.test',
      sender: createFetchSender({ fetch: stampingFetch(stamp) }),
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/x', delay: 1000 });
    const start = Date.now();

    const promise = send(connector, request);

    await vi.advanceTimersByTimeAsync(999);
    expect(stamp.at).toBeNull(); // still waiting

    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(stamp.at).not.toBeNull();
    expect((stamp.at as number) - start).toBe(1000);
  });

  it('a request delay overrides the connector delay', async () => {
    vi.useFakeTimers();
    const stamp: { at: number | null } = { at: null };
    const connector = defineConnector({
      baseUrl: 'https://example.test',
      sender: createFetchSender({ fetch: stampingFetch(stamp) }),
      delay: 5000,
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/x', delay: 200 });
    const start = Date.now();

    const promise = send(connector, request);
    await vi.advanceTimersByTimeAsync(200);
    await promise;

    expect((stamp.at as number) - start).toBe(200);
  });

  it('skips the delay entirely for a mocked response', async () => {
    // Fake timers are installed but never advanced; if the delay ran, the send
    // would hang on sleep(10_000). The mock path must not sleep.
    vi.useFakeTimers();
    const mock = createMockClient(
      new Map<unknown, MockValue>([['getThing', mockResponse({ ok: true })]]),
    );
    const connector = defineConnector({
      baseUrl: 'https://api.example.com',
      name: 'api',
      delay: 10_000,
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/thing', name: 'getThing' });

    const response = await send(connector, request, { mockClient: mock });

    expect(response.status()).toBe(200);
  });

  it('no delay sends immediately', async () => {
    vi.useFakeTimers();
    const stamp: { at: number | null } = { at: null };
    const connector = defineConnector({
      baseUrl: 'https://example.test',
      sender: createFetchSender({ fetch: stampingFetch(stamp) }),
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/x' });
    const start = Date.now();

    const promise = send(connector, request);
    await vi.advanceTimersByTimeAsync(0);
    await promise;

    expect((stamp.at as number) - start).toBe(0);
  });
});

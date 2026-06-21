// Port of ../saloon/src/Contracts/MockClient.php + ../saloon/src/Data/RecordedResponse.php
// (the contract only; the factory lives in `src/faking/mockClient.ts`).
//
// With no request/connector classes, "match this request type" keys off the
// request's / connector's `name` (see api-style.md). A mock-map key is therefore:
//   - a **string**: matched against the request `name`, then the connector `name`,
//     then as a URL pattern (`*` wildcard) against the pending URL;
//   - a **factory function**: matched by its `.name` against those same names
//     (tests run unminified, so factory names are stable);
// otherwise responses are consumed from an ordered **sequence**.

import type { FakeResponse } from '@/contracts/FakeResponse';
import type { Fixture } from '@/contracts/Fixture';
import type { Request } from '@/contracts/Request';
import type { Response } from '@/contracts/Response';
import type { PendingRequest } from '@/http/pendingRequest';

/** A value the mock client can return: a ready fake, or a disk-backed fixture. */
export type MockValue = FakeResponse | Fixture;

/** One recorded round-trip through the mock client. */
export interface RecordedResponse {
  pendingRequest: PendingRequest;
  request: Request;
  response: Response;
}

/**
 * A target for matching/asserting against recorded sends:
 *   - a string (request/connector `name`, or a URL pattern),
 *   - a factory function (matched by `.name`),
 *   - a predicate `(pending, response) => boolean` (a function of arity ≥ 2).
 */
// biome-ignore lint/complexity/noBannedTypes: a factory/predicate target is genuinely any function.
export type SentMatcher = string | Function;

export interface MockClient {
  /** Register keyed responses (Map) and/or a sequence (array). Chainable. */
  addResponses(responses: Map<unknown, MockValue> | MockValue[]): MockClient;
  /** Register one response, keyed (named/URL/factory) or appended to the sequence. */
  addResponse(response: MockValue, key?: unknown): MockClient;
  /** Resolve the next mock for a pending request (throws if none is defined). */
  guessNextResponse(pending: PendingRequest): MockValue;
  /** Record a completed round-trip (used by `send`). */
  recordResponse(pending: PendingRequest, response: Response): void;
  getRecordedResponses(): RecordedResponse[];
  getLastRequest(): Request | undefined;
  getLastPendingRequest(): PendingRequest | undefined;
  getLastResponse(): Response | undefined;
  assertSent(target: SentMatcher): void;
  assertNotSent(target: SentMatcher): void;
  assertSentCount(count: number, target?: SentMatcher): void;
  assertNothingSent(): void;
  assertSentInOrder(targets: SentMatcher[]): void;
  findResponseByRequest(target: SentMatcher, index?: number): Response | undefined;
  findResponseByRequestUrl(url: string, index?: number): Response | undefined;
}

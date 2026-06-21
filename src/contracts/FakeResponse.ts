// Port of ../saloon/src/Contracts/FakeResponse.php (the contract only).
//
// Slice 4 introduced this thin so the middleware pipeline could recognise a fake
// response returned from a request pipe. Slice 6 fills in the producers
// (`mockResponse`/`fixture`), the `createFakeResponse` materializer, and the
// optional `getError` hook a `mockResponse().throw()` uses to reject the send.
//
// PHP distinguished a fake response with `instanceof`; interfaces have no runtime
// identity, so a `FakeResponse` is marked with a symbol brand and detected with
// `isFakeResponse`.

import type { BodyRepository } from '@/contracts/BodyRepository';
import type { Response } from '@/contracts/Response';
import type { PendingRequest } from '@/http/pendingRequest';
import type { ArrayStore } from '@/repositories/arrayStore';

/** Brand marking an object as a `FakeResponse` (PHP's `instanceof` stand-in). */
export const FAKE_RESPONSE_BRAND: unique symbol = Symbol('saloon.fakeResponse');

export interface FakeResponse {
  readonly [FAKE_RESPONSE_BRAND]: true;
  status(): number;
  headers(): ArrayStore<string>;
  body(): BodyRepository;
  /**
   * When the fake was marked via `mockResponse().throw()`, the error to reject the
   * send with (given the materialized response). Absent ⇒ the send resolves.
   */
  getError?(pending: PendingRequest, response: Response): Error | undefined;
}

export function isFakeResponse(value: unknown): value is FakeResponse {
  return typeof value === 'object' && value !== null && FAKE_RESPONSE_BRAND in value;
}

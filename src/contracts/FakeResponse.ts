// Port of ../saloon/src/Contracts/FakeResponse.php (the contract only).
//
// Introduced thin in Slice 4: the middleware pipeline must recognise a fake
// response returned from a request pipe so it can stash it on the pending request
// and short-circuit the real sender. The producers (`mockResponse`), the
// `createFakeResponse` materializer, and the `send` fake-branch arrive in Slice 6.
//
// PHP distinguished a fake response with `instanceof`; interfaces have no runtime
// identity, so a `FakeResponse` is marked with a symbol brand and detected with
// `isFakeResponse`.

import type { BodyRepository } from '@/contracts/BodyRepository';
import type { ArrayStore } from '@/repositories/arrayStore';

/** Brand marking an object as a `FakeResponse` (PHP's `instanceof` stand-in). */
export const FAKE_RESPONSE_BRAND: unique symbol = Symbol('saloon.fakeResponse');

export interface FakeResponse {
  readonly [FAKE_RESPONSE_BRAND]: true;
  status(): number;
  headers(): ArrayStore<string>;
  body(): BodyRepository;
}

export function isFakeResponse(value: unknown): value is FakeResponse {
  return typeof value === 'object' && value !== null && FAKE_RESPONSE_BRAND in value;
}

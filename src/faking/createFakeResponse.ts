// Turn a `FakeResponse` (from `mockResponse` or a replayed fixture) into a real
// `Response`. We build a native `globalThis.Response` from the fake's status / body
// / headers and run it through the same `responseFromFetch` reader the live path
// uses, so the reading surface is identical — only `isMocked()` differs.

import type { FakeResponse } from '@/contracts/FakeResponse';
import type { Response } from '@/contracts/Response';
import type { PendingRequest } from '@/http/pendingRequest';
import { type ResponseFlags, responseFromFetch } from '@/http/response';

// Statuses the fetch `Response` constructor forbids a body on.
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

export function fakeResponseToResponse(
  fake: FakeResponse,
  pending: PendingRequest,
  flags: ResponseFlags = { mocked: true },
): Promise<Response> {
  const status = fake.status();
  const headers = new Headers();
  for (const [key, value] of Object.entries(fake.headers().all())) headers.set(key, String(value));

  // Materialize whatever body the fake carries, verbatim. Unlike the live *request*
  // path (which drops an "empty" body, including the PHP `empty()` quirk where `'0'`
  // counts as empty), a mocked *response* must reflect its body exactly — so
  // `mockResponse({})` yields `{}` and `mockResponse('0')` yields `'0'`.
  const { body, contentType } = fake.body().toRequestBody();
  let bodyInit: BodyInit | null = body;
  if (contentType !== null && !headers.has('content-type')) {
    headers.set('content-type', contentType);
  }
  // Statuses the fetch `Response` constructor forbids a body on.
  if (NULL_BODY_STATUSES.has(status)) bodyInit = null;

  const native = new Response(bodyInit, { status, headers });
  return responseFromFetch(native, pending, {}, undefined, flags);
}

/** Materialize the fake stashed on the pending request (the `send` mock branch). */
export function createFakeResponse(pending: PendingRequest): Promise<Response> {
  const fake = pending.getFakeResponse();
  if (!fake) {
    throw new Error('createFakeResponse: the pending request carries no fake response');
  }
  return fakeResponseToResponse(fake, pending, { mocked: true });
}

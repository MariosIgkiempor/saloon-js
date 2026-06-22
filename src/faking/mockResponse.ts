// Port of ../saloon/src/Http/Faking/MockResponse.php
//
// A `mockResponse` is a `FakeResponse` (carrying a body repo, status and headers)
// plus a `.throw()` switch: calling it marks the fake so that `send` rejects after
// recording. With no argument the error defaults to the `RequestError` built from
// the (failed) response; an explicit error or `(pending, response) => Error`
// factory overrides it.

import type { BodyRepository } from '@/contracts/BodyRepository';
import { FAKE_RESPONSE_BRAND, type FakeResponse } from '@/contracts/FakeResponse';
import type { Response } from '@/contracts/Response';
import { createRequestError } from '@/errors/RequestError';
import type { PendingRequest } from '@/http/pendingRequest';
import { createArrayStore } from '@/repositories/arrayStore';
import { jsonBody } from '@/repositories/body/jsonBody';
import { stringBody } from '@/repositories/body/stringBody';

type ErrorFactory = (pending: PendingRequest, response: Response) => Error;

export interface MockResponse extends FakeResponse {
  /** Mark the fake to reject the send (after recording). Chainable. */
  throw(errorOrFactory?: Error | ErrorFactory): MockResponse;
}

export function mockResponse(
  body: Record<string, unknown> | string | BodyRepository = {},
  status = 200,
  headers: Record<string, string> = {},
): MockResponse {
  const bodyRepository = toBodyRepository(body);
  const headerStore = createArrayStore<string>(headers);
  let willThrow = false;
  let customError: Error | ErrorFactory | undefined;

  const fake: MockResponse = {
    [FAKE_RESPONSE_BRAND]: true,
    status: () => status,
    headers: () => headerStore,
    body: () => bodyRepository,
    getError(pending, response) {
      if (!willThrow) return undefined;
      if (typeof customError === 'function') return customError(pending, response);
      return customError ?? createRequestError(response);
    },
    throw(errorOrFactory) {
      willThrow = true;
      customError = errorOrFactory;
      return fake;
    },
  };

  return fake;
}

function isBodyRepository(value: unknown): value is BodyRepository {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toRequestBody?: unknown }).toRequestBody === 'function'
  );
}

function toBodyRepository(body: Record<string, unknown> | string | BodyRepository): BodyRepository {
  if (typeof body === 'string') return stringBody(body);
  if (isBodyRepository(body)) return body;
  return jsonBody(body);
}

// Port of ../saloon/src/Http/Connector.php::send + ../saloon/src/Traits/Connector/SendsRequests.php
//
// Build a pending request, run it through the request middleware pipeline, then
// either materialize a stashed fake response (mock/fixture) or hand it to the
// sender, then run the response pipeline. Transport failures feed the fatal
// pipeline.
//
// Slice 5 wraps that single attempt in the retry loop: up to `tries` attempts,
// optional (exponential) `retryInterval` between them, a per-error `handleRetry`
// gate, and `throwOnMaxTries` to choose between throwing and returning the last
// failed response when retries run out. When `tries > 1`, a failed *status* is
// forced down the retry path via `response.throw()`. Discrimination is via the
// Slice-3 predicates, never `instanceof`.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { Response } from '@/contracts/Response';
import { isFatalRequestError, isRequestError } from '@/errors';
import type { RequestError } from '@/errors/RequestError';
import { createFakeResponse } from '@/faking/createFakeResponse';
import { sleep } from '@/helpers/sleep';
import { createPendingRequest, type SendOptions } from '@/http/pendingRequest';
import { resolveTokenStoreAuth } from '@/oauth2/tokenStore';
import { isErr } from '@/result';

interface SendFn {
  <TDto = unknown>(
    connector: Connector,
    request: Request<TDto>,
    options?: SendOptions,
  ): Promise<Response<TDto>>;
  /** Curry a connector: `const api = send.with(connector)`. */
  with(
    connector: Connector,
  ): <TDto = unknown>(request: Request<TDto>, options?: SendOptions) => Promise<Response<TDto>>;
}

// Errors injected by a mock's `.throw()` are user-authored, not real failures, so
// the retry loop must let them escape immediately. We tag them here rather than by
// type, because the default `.throw()` error is an ordinary `RequestError` —
// indistinguishable by type from a real failed-status error. A WeakSet avoids
// mutating (possibly frozen) error objects.
const fakeThrownErrors = new WeakSet<object>();

/** A single send attempt: build → request pipeline → sender/fake → response pipeline. */
async function attempt<TDto>(
  connector: Connector,
  request: Request<TDto>,
  options: SendOptions,
  forceThrow: boolean,
): Promise<Response<TDto>> {
  const pending = createPendingRequest(connector, request, options);

  // Run the request middleware pipeline (mutates the pending request; a pipe — e.g.
  // determineMockResponse — may stash a fake response that short-circuits the sender).
  await pending.middleware.executeRequestPipeline(pending);

  const mockClient = pending.getMockClient();

  let response: Response;
  try {
    response = pending.hasFakeResponse()
      ? await createFakeResponse(pending)
      : await connector.sender.send(pending);
  } catch (error) {
    // Only the transport failure (FatalRequestError) reaches here; let fatal pipes
    // observe it, then re-throw so the retry loop / caller can react.
    if (error instanceof Error) await pending.middleware.executeFatalPipeline(error);
    throw error;
  }

  // Record before any throw, so mock assertions still see the round-trip.
  mockClient?.recordResponse(pending, response);

  // A mock marked via `.throw()` rejects here (after recording). Tag it so the
  // retry loop treats it as terminal, never retrying a user-injected failure.
  const fakeError = pending.getFakeResponse()?.getError?.(pending, response);
  if (fakeError) {
    if (typeof fakeError === 'object') fakeThrownErrors.add(fakeError);
    throw fakeError;
  }

  // Response pipes may replace the response or throw (e.g. `alwaysThrowOnErrors`).
  response = await pending.middleware.executeResponsePipeline(response);

  // With retries enabled, a failed status must enter the retry path: surface it as
  // a thrown RequestError (a no-op on a successful response).
  if (forceThrow) response.throw();

  // Eager validation: on a *successful* response carrying a validator, validate the
  // body and throw the ValidationError on failure (the second deliberate exception
  // to "send throws only the network error"). Failed statuses are never validated
  // against the success type. The result is memoized for later `dto()`/`validate()`.
  if ((request.validator ?? connector.validator) !== undefined && response.successful()) {
    const validation = await response.validateAsync();
    if (isErr(validation)) throw validation.error;
  }

  return response as Response<TDto>;
}

async function sendRequest<TDto = unknown>(
  connector: Connector,
  request: Request<TDto>,
  options: SendOptions = {},
): Promise<Response<TDto>> {
  // When the connector carries a token store, load/refresh/save the authenticator
  // and thread it in as this call's auth (no-op without a store, or when auth is
  // already supplied / `skipTokenStore` is set by the internal grant requests).
  options = await resolveTokenStoreAuth(connector, request, options);

  const maxTries = request.tries ?? connector.tries ?? 1;
  const interval = request.retryInterval ?? connector.retryInterval ?? 0;
  const backoff = request.useExponentialBackoff ?? connector.useExponentialBackoff ?? false;
  const throwOnMaxTries = request.throwOnMaxTries ?? connector.throwOnMaxTries ?? true;

  let lastError: unknown;
  for (let n = 1; n <= maxTries; n++) {
    if (n > 1 && interval > 0) await sleep(backoff ? interval * 2 ** (n - 2) : interval);

    try {
      return await attempt(connector, request, options, maxTries > 1);
    } catch (error) {
      // A fake `.throw()` (even when its default error is a RequestError) and any
      // non-Saloon error escape immediately — never retried.
      if (typeof error === 'object' && error !== null && fakeThrownErrors.has(error)) throw error;
      if (!isFatalRequestError(error) && !isRequestError(error)) throw error;
      lastError = error;

      if (n === maxTries) break;

      // Both gates must allow the retry (default: always).
      const requestAllows = (await request.handleRetry?.(error as Error)) ?? true;
      const connectorAllows = (await connector.handleRetry?.(error as Error)) ?? true;
      if (!requestAllows || !connectorAllows) break;
    }
  }

  // Retries exhausted (or a gate stopped them). A RequestError carries the failed
  // response, which we hand back when the caller opted out of throwing.
  if (!throwOnMaxTries && isRequestError(lastError)) {
    return (lastError as RequestError).getResponse() as Response<TDto>;
  }
  throw lastError;
}

function withConnector(connector: Connector) {
  return <TDto = unknown>(request: Request<TDto>, options?: SendOptions): Promise<Response<TDto>> =>
    sendRequest<TDto>(connector, request, options);
}

export const send: SendFn = Object.assign(sendRequest, { with: withConnector });

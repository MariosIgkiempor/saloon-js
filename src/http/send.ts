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

  // A mock marked via `.throw()` rejects here (after recording).
  const fakeError = pending.getFakeResponse()?.getError?.(pending, response);
  if (fakeError) throw fakeError;

  // Response pipes may replace the response or throw (e.g. `alwaysThrowOnErrors`).
  response = await pending.middleware.executeResponsePipeline(response);

  // With retries enabled, a failed status must enter the retry path: surface it as
  // a thrown RequestError (a no-op on a successful response).
  if (forceThrow) response.throw();

  return response as Response<TDto>;
}

async function sendRequest<TDto = unknown>(
  connector: Connector,
  request: Request<TDto>,
  options: SendOptions = {},
): Promise<Response<TDto>> {
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
      // A non-Saloon error (or a fake `.throw()`) escapes immediately — never retried.
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

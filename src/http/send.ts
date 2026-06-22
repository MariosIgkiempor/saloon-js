// Port of ../saloon/src/Http/Connector.php::send (the free entrypoint)
//
// Build a pending request, run it through the request middleware pipeline, then
// either materialize a stashed fake response (mock/fixture) or hand it to the
// sender, then run the response pipeline. Transport failures feed the fatal
// pipeline. The retry loop (Slice 5) wraps this same call later.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { Response } from '@/contracts/Response';
import { createFakeResponse } from '@/faking/createFakeResponse';
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

async function sendRequest<TDto = unknown>(
  connector: Connector,
  request: Request<TDto>,
  options: SendOptions = {},
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
    // observe it, then re-throw so callers' `await`/`try-catch` behave as expected.
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
  return response as Response<TDto>;
}

function withConnector(connector: Connector) {
  return <TDto = unknown>(request: Request<TDto>, options?: SendOptions): Promise<Response<TDto>> =>
    sendRequest<TDto>(connector, request, options);
}

export const send: SendFn = Object.assign(sendRequest, { with: withConnector });

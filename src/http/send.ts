// Port of ../saloon/src/Http/Connector.php::send (the free entrypoint)
//
// Build a pending request, run it through the middleware pipeline, hand it to the
// sender, then run the response pipeline. The retry loop (Slice 5) and the fake/
// mock branch (Slice 6) hang off this same call later — Slice 6 adds the
// `pending.hasFakeResponse()` branch that short-circuits the sender.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { Response } from '@/contracts/Response';
import { createPendingRequest } from '@/http/pendingRequest';

interface SendFn {
  <TDto = unknown>(connector: Connector, request: Request<TDto>): Promise<Response<TDto>>;
  /** Curry a connector: `const api = send.with(connector)`. */
  with(connector: Connector): <TDto = unknown>(request: Request<TDto>) => Promise<Response<TDto>>;
}

async function sendRequest<TDto = unknown>(
  connector: Connector,
  request: Request<TDto>,
): Promise<Response<TDto>> {
  const pending = createPendingRequest(connector, request);

  // Run the request middleware pipeline (mutates the pending request; a pipe may
  // stash a fake response — the branch that consumes it lands in Slice 6).
  await pending.middleware.executeRequestPipeline(pending);

  let response: Response;
  try {
    response = await connector.sender.send(pending);
  } catch (error) {
    // Only the transport failure (FatalRequestError) reaches here; let fatal pipes
    // observe it, then re-throw so callers' `await`/`try-catch` behave as expected.
    if (error instanceof Error) await pending.middleware.executeFatalPipeline(error);
    throw error;
  }

  // Response pipes may replace the response or throw (e.g. `alwaysThrowOnErrors`).
  response = await pending.middleware.executeResponsePipeline(response);
  return response as Response<TDto>;
}

function withConnector(connector: Connector) {
  return <TDto = unknown>(request: Request<TDto>): Promise<Response<TDto>> =>
    sendRequest<TDto>(connector, request);
}

export const send: SendFn = Object.assign(sendRequest, { with: withConnector });

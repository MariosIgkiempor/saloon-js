// Port of ../saloon/src/Http/Connector.php::send (the free entrypoint)
//
// Slice 1: build a pending request, hand it to the connector's sender, return.
// The retry loop (Slice 5), response pipeline (Slice 4) and mock (Slice 6) hang
// off this same call later.

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
  return connector.sender.send(pending);
}

function withConnector(connector: Connector) {
  return <TDto = unknown>(request: Request<TDto>): Promise<Response<TDto>> =>
    sendRequest<TDto>(connector, request);
}

export const send: SendFn = Object.assign(sendRequest, { with: withConnector });

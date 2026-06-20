// Port of ../saloon/src/Http/Response.php (the Slice 1 reading surface)
//
// Wraps a native fetch `Response`. The body is buffered once up front, because
// fetch bodies are single-use streams — every read here is from that buffer.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { Response } from '@/contracts/Response';
import type { PendingRequest } from '@/http/pendingRequest';
import { createArrayStore } from '@/repositories/arrayStore';

export async function responseFromFetch(
  res: globalThis.Response,
  pending: PendingRequest,
  _fetchRequest: RequestInit,
  _cause?: unknown,
): Promise<Response> {
  const bodyText = await res.text();
  const headerStore = createArrayStore<string>(Object.fromEntries(res.headers.entries()));

  return {
    status: () => res.status,
    headers: () => headerStore,
    body: () => bodyText,
    json: <T = unknown>(): T => JSON.parse(bodyText) as T,
    getPendingRequest: () => pending,
    getRequest: (): Request => pending.getRequest(),
    getConnector: (): Connector => pending.getConnector(),
    getFetchResponse: () => res,
  };
}

// Port of ../saloon/src/Http/PendingRequest.php (URL/method/header/query build)
//
// The one intentionally-mutable object: created per `send()`, never shared. Slice
// 1 builds it inline (URL, method, merged headers/query); the tap/middleware list
// arrives in Slices 2–4.

import type { Connector, HeaderValue, QueryValue } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { Response } from '@/contracts/Response';
import type { Method } from '@/enums';
import { joinUrl } from '@/helpers/urlHelper';
import { responseFromFetch } from '@/http/response';
import { type ArrayStore, createArrayStore } from '@/repositories/arrayStore';

export type ResponseFactory = (
  res: globalThis.Response,
  pending: PendingRequest,
  fetchRequest: RequestInit,
  cause?: unknown,
) => Promise<Response>;

export interface PendingRequest {
  url: string;
  method: Method;
  headers: ArrayStore<HeaderValue>;
  query: ArrayStore<QueryValue>;
  getConnector(): Connector;
  getRequest(): Request;
  getResponseFactory(): ResponseFactory;
  /** Materialize the native fetch `(url, init)` pair from the current state. */
  createFetchRequest(): { url: string; init: RequestInit };
}

export function createPendingRequest<TDto>(
  connector: Connector,
  request: Request<TDto>,
): PendingRequest {
  // Connector first, then request — the request wins on conflicts.
  const headers = createArrayStore<HeaderValue>().merge(
    connector.headers.all(),
    request.headers.all(),
  );
  const query = createArrayStore<QueryValue>().merge(connector.query.all(), request.query.all());

  const pending: PendingRequest = {
    url: joinUrl(resolveBaseUrl(connector), resolveEndpoint(request), request.allowBaseUrlOverride),
    method: request.method,
    headers,
    query,
    getConnector: () => connector,
    getRequest: () => request,
    getResponseFactory: () => responseFromFetch,
    createFetchRequest: () => buildFetchRequest(pending),
  };

  return pending;
}

function buildFetchRequest(pending: PendingRequest): { url: string; init: RequestInit } {
  // Existing endpoint query first, then the query store wins on conflicts.
  const url = new URL(pending.url);
  for (const [key, value] of Object.entries(pending.query.all())) {
    url.searchParams.set(key, String(value));
  }

  // The `Headers` object case-folds names — this is where the literal stores
  // become a single, case-insensitive header set.
  const headers = new Headers();
  for (const [key, value] of Object.entries(pending.headers.all())) {
    headers.set(key, String(value));
  }

  return { url: url.toString(), init: { method: pending.method, headers } };
}

function resolveBaseUrl(connector: Connector): string {
  return typeof connector.baseUrl === 'function' ? connector.baseUrl(connector) : connector.baseUrl;
}

function resolveEndpoint<TDto>(request: Request<TDto>): string {
  return typeof request.endpoint === 'function' ? request.endpoint(request) : request.endpoint;
}

// Port of ../saloon/src/Http/PendingRequest.php (URL/method/header/query/body build)
//
// The one intentionally-mutable object: created per `send()`, never shared. Slice 2
// introduces the explicit tap sequence (`mergeRequestProperties → mergeBody`) that
// later slices extend with boot/auth/delay; taps mutate the pending request in
// order before it is materialized into a native fetch request.

import type { BodyRepository } from '@/contracts/BodyRepository';
import type { ConfigValue, Connector, HeaderValue, QueryValue } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { Response } from '@/contracts/Response';
import type { Method } from '@/enums';
import { joinUrl } from '@/helpers/urlHelper';
import { mergeBody } from '@/http/pending/mergeBody';
import { mergeRequestProperties } from '@/http/pending/mergeRequestProperties';
import { responseFromFetch } from '@/http/response';
import { type ArrayStore, createArrayStore } from '@/repositories/arrayStore';

export type ResponseFactory = (
  res: globalThis.Response,
  pending: PendingRequest,
  fetchRequest: RequestInit,
  cause?: unknown,
) => Promise<Response>;

/** The ordered tap sequence; later slices append boot/auth/delay taps. */
type Tap = (pending: PendingRequest) => void;
const TAPS: Tap[] = [mergeRequestProperties, mergeBody];

export interface PendingRequest {
  url: string;
  method: Method;
  headers: ArrayStore<HeaderValue>;
  query: ArrayStore<QueryValue>;
  config: ArrayStore<ConfigValue>;
  getConnector(): Connector;
  getRequest(): Request;
  getResponseFactory(): ResponseFactory;
  /** The merged body, set by the MergeBody tap. */
  getBody(): BodyRepository | undefined;
  setBody(body: BodyRepository | undefined): void;
  /** Materialize the native fetch `(url, init)` pair from the current state. */
  createFetchRequest(): { url: string; init: RequestInit };
}

export function createPendingRequest<TDto>(
  connector: Connector,
  request: Request<TDto>,
): PendingRequest {
  let body: BodyRepository | undefined;

  // Stores start empty; the taps merge connector→request into them.
  const pending: PendingRequest = {
    url: joinUrl(resolveBaseUrl(connector), resolveEndpoint(request), request.allowBaseUrlOverride),
    method: request.method,
    headers: createArrayStore<HeaderValue>(),
    query: createArrayStore<QueryValue>(),
    config: createArrayStore<ConfigValue>(),
    getConnector: () => connector,
    getRequest: () => request,
    getResponseFactory: () => responseFromFetch,
    getBody: () => body,
    setBody: (next) => {
      body = next;
    },
    createFetchRequest: () => buildFetchRequest(pending),
  };

  for (const tap of TAPS) {
    tap(pending);
  }

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

  const init: RequestInit = { method: pending.method, headers };

  const body = pending.getBody();
  if (body && !body.isEmpty()) {
    const { body: requestBody, contentType } = body.toRequestBody();
    init.body = requestBody;
    if (body.kind === 'multipart') {
      // Let fetch generate `multipart/form-data; boundary=…` itself.
      headers.delete('content-type');
    } else if (contentType !== null && !headers.has('content-type')) {
      // A Content-Type already set by a header wins over the body's default.
      headers.set('Content-Type', contentType);
    }
  }

  return { url: url.toString(), init };
}

function resolveBaseUrl(connector: Connector): string {
  return typeof connector.baseUrl === 'function' ? connector.baseUrl(connector) : connector.baseUrl;
}

function resolveEndpoint<TDto>(request: Request<TDto>): string {
  return typeof request.endpoint === 'function' ? request.endpoint(request) : request.endpoint;
}

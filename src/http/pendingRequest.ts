// Port of ../saloon/src/Http/PendingRequest.php (URL/method/header/query/body build
// + the boot/auth/middleware lifecycle).
//
// The one intentionally-mutable object: created per `send()`, never shared. Slice 2
// introduced the explicit tap sequence; Slice 4 extends it to the full lifecycle
// (boot plugins → merge properties → merge body → authenticate → boot
// connector/request) and gives the pending request a middleware pipeline. The
// *async* request pipeline itself is executed by `send` (the async orchestrator),
// after which the sender — or, from Slice 6, a stashed fake response — produces the
// Response.

import type { Authenticator } from '@/contracts/Authenticator';
import type { BodyRepository } from '@/contracts/BodyRepository';
import type { ConfigValue, Connector, HeaderValue, QueryValue } from '@/contracts/Connector';
import type { FakeResponse } from '@/contracts/FakeResponse';
import type { MockClient } from '@/contracts/MockClient';
import type { Request } from '@/contracts/Request';
import type { Response } from '@/contracts/Response';
import type { Method } from '@/enums';
import { getGlobalMockClient } from '@/faking/mockClient';
import { createMiddlewarePipeline, type MiddlewarePipeline } from '@/helpers/middlewarePipeline';
import { joinUrl } from '@/helpers/urlHelper';
import { delayMiddleware } from '@/http/middleware/delay';
import { determineMockResponse } from '@/http/middleware/determineMockResponse';
import { validateProperties } from '@/http/middleware/validateProperties';
import { authenticate } from '@/http/pending/authenticate';
import { bootConnectorAndRequest } from '@/http/pending/bootConnectorAndRequest';
import { bootPlugins } from '@/http/pending/bootPlugins';
import { mergeBody } from '@/http/pending/mergeBody';
import { mergeDelay } from '@/http/pending/mergeDelay';
import { mergeRequestProperties } from '@/http/pending/mergeRequestProperties';
import { responseFromFetch } from '@/http/response';
import { type ArrayStore, createArrayStore } from '@/repositories/arrayStore';
import { createIntegerStore, type IntegerStore } from '@/repositories/integerStore';

/** Per-call options threaded into `send` (and on to the pending request). */
export interface SendOptions {
  /** Mock client for this call (beats request/connector/global mock clients). */
  mockClient?: MockClient;
}

export type ResponseFactory = (
  res: globalThis.Response,
  pending: PendingRequest,
  fetchRequest: RequestInit,
  cause?: unknown,
) => Promise<Response>;

/** The ordered sync tap sequence run at build time (boot → merge → authenticate). */
type Tap = (pending: PendingRequest) => void;
const TAPS: Tap[] = [
  bootPlugins,
  mergeRequestProperties,
  mergeBody,
  mergeDelay,
  authenticate,
  bootConnectorAndRequest,
];

export interface PendingRequest {
  url: string;
  method: Method;
  headers: ArrayStore<HeaderValue>;
  query: ArrayStore<QueryValue>;
  config: ArrayStore<ConfigValue>;
  /** Milliseconds to delay before sending, set by the MergeDelay tap (null = none). */
  delay: IntegerStore;
  /** This send's request/response/fatal middleware pipeline. */
  middleware: MiddlewarePipeline;
  getConnector(): Connector;
  getRequest(): Request;
  getResponseFactory(): ResponseFactory;
  /** The resolved authenticator (request auth beats connector auth), or undefined. */
  getAuthenticator(): Authenticator | undefined;
  /** The resolved mock client (call ?? request ?? connector ?? global), or undefined. */
  getMockClient(): MockClient | undefined;
  /** The merged body, set by the MergeBody tap. */
  getBody(): BodyRepository | undefined;
  setBody(body: BodyRepository | undefined): void;
  /** A fake response stashed by a request pipe (the mock path lands in Slice 6). */
  setFakeResponse(fake: FakeResponse): void;
  getFakeResponse(): FakeResponse | undefined;
  hasFakeResponse(): boolean;
  /** Materialize the native fetch `(url, init)` pair from the current state. */
  createFetchRequest(): { url: string; init: RequestInit };
}

export function createPendingRequest<TDto>(
  connector: Connector,
  request: Request<TDto>,
  options: SendOptions = {},
): PendingRequest {
  let body: BodyRepository | undefined;
  let fakeResponse: FakeResponse | undefined;

  // Resolve the authenticator once, lazily: request auth beats connector auth, and
  // either may be a thunk (resolved here).
  let authenticatorResolved = false;
  let authenticator: Authenticator | undefined;
  const resolveAuthenticator = (): Authenticator | undefined => {
    if (!authenticatorResolved) {
      const auth = request.auth ?? connector.auth;
      authenticator = typeof auth === 'function' ? auth() : auth;
      authenticatorResolved = true;
    }
    return authenticator;
  };

  // Mock client precedence: per-call → request → connector → process-global.
  const mockClient =
    options.mockClient ?? request.mockClient ?? connector.mockClient ?? getGlobalMockClient();

  // Stores start empty; the taps merge connector→request into them.
  const pending: PendingRequest = {
    url: joinUrl(resolveBaseUrl(connector), resolveEndpoint(request), request.allowBaseUrlOverride),
    method: request.method,
    headers: createArrayStore<HeaderValue>(),
    query: createArrayStore<QueryValue>(),
    config: createArrayStore<ConfigValue>(),
    delay: createIntegerStore(),
    middleware: createMiddlewarePipeline(),
    getConnector: () => connector,
    getRequest: () => request,
    getResponseFactory: () => responseFromFetch,
    getAuthenticator: resolveAuthenticator,
    getMockClient: () => mockClient,
    getBody: () => body,
    setBody: (next) => {
      body = next;
    },
    setFakeResponse: (next) => {
      fakeResponse = next;
    },
    getFakeResponse: () => fakeResponse,
    hasFakeResponse: () => fakeResponse !== undefined,
    createFetchRequest: () => buildFetchRequest(pending),
  };

  for (const tap of TAPS) {
    tap(pending);
  }

  // Registered after the taps so they run once the plugin/user request pipes are in
  // place; the async pipeline itself runs in `send`. `determineMockResponse` may
  // stash a fake response that short-circuits the sender.
  pending.middleware.onRequest(determineMockResponse, 'determineMockResponse');
  pending.middleware.onRequest(validateProperties, 'validateProperties');
  // Registered last so the delay is awaited after every other request pipe has
  // settled the pending request (mirrors PHP's DelayMiddleware ordering).
  pending.middleware.onRequest(delayMiddleware, 'delay');

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

  // Connector then request fetch hooks get the last word over the native init.
  const connector = pending.getConnector();
  const request = pending.getRequest();
  let finalInit = init;
  finalInit = connector.handleFetchRequest?.(finalInit, pending) ?? finalInit;
  finalInit = request.handleFetchRequest?.(finalInit, pending) ?? finalInit;

  return { url: url.toString(), init: finalInit };
}

function resolveBaseUrl(connector: Connector): string {
  return typeof connector.baseUrl === 'function' ? connector.baseUrl(connector) : connector.baseUrl;
}

function resolveEndpoint<TDto>(request: Request<TDto>): string {
  return typeof request.endpoint === 'function' ? request.endpoint(request) : request.endpoint;
}

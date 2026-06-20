# Phase 3 — Core round-trip (the usable milestone)

> **API style:** functional, no classes — see `api-style.md`. Connectors and
> requests are **values from `defineConnector`/`defineRequest`**; `send` is a
> **free function**. PendingRequest/Response/FetchSender are **factories**.

## Goal
A real HTTP request works end-to-end: build a connector + request with the define functions, `await send(connector, request)`, get a `Response` you can read. This is the spine of the library. No retries, plugins, auth, or mocking yet (stubs/hooks in place).

## Files

### `src/http/defineConnector.ts`
`export function defineConnector(config: ConnectorConfig): Connector` — normalizes and **freezes** the config into a reusable `Connector` value. No subclassing; the PHP `default*()` overrides are config fields (a value **or** a thunk for laziness). `ConnectorConfig`:
- `baseUrl: string | (c: Connector) => string` (required; was `resolveBaseUrl()`)
- `headers?`, `query?`, `config?`: `Record<string, …> | (c) => Record<…>` (were `defaultHeaders/Query/Config()`)
- `auth?: Authenticator | (c) => Authenticator | undefined` (was `defaultAuth()`)
- `body?: BodyRepository | (c) => BodyRepository | undefined` (was `defaultBody()`)
- `plugins?: Plugin[]` (was `plugins()`)
- `middleware?: (pipeline: MiddlewarePipeline) => void` (register middleware; replaces overriding + `$this->middleware()`)
- `boot?: (pending: PendingRequest) => void` (was `boot()`)
- `handleFetchRequest?: (init: RequestInit, pending) => RequestInit` (identity default)
- `sender?: Sender` (defaults to `fetchSender`)
- `responseFactory?` (Phase 4 custom responses), `name?: string` (diagnostics/mock matching)
- retry fields + `tokens` store come in Phases 5/7.

The returned `Connector` value carries the **normalized** config plus the resolved base auth. Per-call auth override is `withAuth(connector, auth)` (returns a new connector), not a mutating `authenticate()` method.

### `src/http/defineRequest.ts` (generic `<TDto = unknown>`)
`export function defineRequest<TDto = unknown>(config: RequestConfig<TDto>): Request<TDto>`. `RequestConfig<TDto>`:
- `method: Method`
- `endpoint: string | (r: Request) => string` (required; was `resolveEndpoint()`)
- same optional `headers/query/config/auth/body/plugins/middleware/boot/handleFetchRequest/name` fields as the connector (value-or-thunk)
- `allowBaseUrlOverride?: boolean`
- `dto?: (response: Response) => TDto` (was `createDtoFromResponse()`)

Usually wrapped by a user factory for parameters, e.g. `const getRepo = (o, r) => defineRequest({ method: Method.GET, endpoint: \`/repos/${o}/${r}\` })`.

### Immutable transformers `src/http/transformers.ts`
Per-call tweaks that previously meant subclassing. Each returns a **new** frozen value, never mutates:
- `withHeaders(target, patch)`, `withQuery(target, patch)`, `withConfig(target, patch)`
- `withBody(target, body)`, `withAuth(target, auth)`, `withMiddleware(target, fn)`
- work on either a `Connector` or a `Request` (generic over both).

### `src/http/send.ts`
`export async function send<TDto>(connector: Connector, request: Request<TDto>, options?: SendOptions): Promise<Response<TDto>>` — the free-function entrypoint (was `connector.send()`). Phase 3 version: build PendingRequest, call sender (or fake), run response pipeline, return. Retry loop added in Phase 5. `options` carries `mockClient?` (Phase 6) and per-call `auth?`.
- Also export a curried convenience `send.with(connector)` → `(request, options?) => Promise<Response>` for reuse without re-passing the connector.
- `createPendingRequest(connector, request, options)` lives here or in PendingRequest.

### `src/http/pendingRequest.ts`
Mirror `../saloon/src/Http/PendingRequest.php` constructor pipeline, as a **factory** producing the one intentionally-**mutable** object (taps/middleware mutate it; created per send, never shared). `export async function createPendingRequest(connector, request, options?): Promise<PendingRequest>` does:
1. `pending.url = joinUrl(resolveBaseUrl(connector), resolveEndpoint(request), allowOverride)` — `resolveBaseUrl`/`resolveEndpoint` evaluate the `baseUrl`/`endpoint` field (call it if it's a thunk, else use the string)
2. `pending.method = request.method`
3. resolve authenticator: `options.auth ?? requestAuth(request) ?? connectorAuth(connector)`
4. resolve mockClient: `options.mockClient ?? request.mockClient ?? connector.mockClient ?? global`
5. `middleware.merge(config.globalMiddleware())`; register `determineMockResponse` (stub in Phase 3 — always no-op until Phase 6)
6. taps in order: `bootPlugins → mergeRequestProperties → mergeBody → mergeDelay → authenticate → bootConnectorAndRequest`
7. register `validateProperties` + `delay` (delay is no-op until Phase 5)
8. `await middleware.executeRequestPipeline(pending)`
- State + accessors on the returned object: `connector`, `request`, `url`/`getUrl`/`setUrl`, `method`/`setMethod`, `headers/query/config/middleware/delay` (own stores, populated by merge taps), `body`/`setBody`, `getAuthenticator`, `hasFakeResponse()`/`getFakeResponse()`/`setFakeResponse()`, `getResponseFactory()` (request → connector → default `responseFromFetch`).
- `createFetchRequest(): { url: string; init: RequestInit }`:
  - build URL with merged query (existing URL query + `query` store, store wins) via `URL`/`URLSearchParams`
  - headers from `headers` store (case-insensitive handling here)
  - body: if `body` && not empty → `toRequestBody()`, set `init.body`, set `Content-Type` if returned non-null and not already set; if `contentType === null` (multipart) **remove** any Content-Type so fetch sets the boundary
  - run `connector` then `request` `handleFetchRequest` hooks
- `executeResponsePipeline(response)`, `executeFatalPipeline(e)` delegate to middleware.

### `src/http/pending/` taps (Phase 3 subset) — plain functions `(pending) => void`
- `bootPlugins.ts` — `for (p of connector.plugins) p.boot(pending); for (p of request.plugins) p.boot(pending)`
- `mergeRequestProperties.ts` — merge headers/query/config (connector then request; request wins) into pending's stores; `pending.middleware.merge(connectorPipeline).merge(requestPipeline)` (each `config.middleware?(pipeline)` is run into a fresh pipeline)
- `mergeBody.ts` — clone connector/request bodies; enforce same body kind; request wins; if both `MergeableBody`, `connectorBody.merge(requestBody.all())`; `pending.setBody(...)`
- `mergeDelay.ts` — set from connector, override with request if set
- `authenticate.ts` — `pending.getAuthenticator()?.set(pending)`
- `bootConnectorAndRequest.ts` — `connector.boot?.(pending); request.boot?.(pending)`

### `src/http/middleware/validateProperties.ts`
Stub function that no-ops (or validates required body presence). Real validation minimal in Phase 3.

### `src/http/response.ts` (generic `<TDto = unknown>`)
A **factory** wrapping the native `fetch` `Response` (no class). Phase 3 surface (rest in Phase 4):
- `export async function responseFromFetch(res: globalThis.Response, pending, fetchRequest, cause?): Promise<Response>` — **buffer the body once** (`await res.text()` / `arrayBuffer()`) since fetch bodies are single-use; store the text. (JS has no seekable streams; buffering is the pragmatic port of PHP's stream handling.) Returns a `Response` object (closure over the buffered body) — also export the `Response<TDto>` interface.
- methods on the object: `status(): number`, `headers(): ArrayStore`, `body(): string`
- `getPendingRequest()`, `getConnector()`, `getRequest()`, `getFetchResponse()`
- `json<T>()` minimal (full keyed overloads in Phase 4)
- `successful()/failed()` minimal (full set in Phase 4)
- `throw()` and `toError()` wired to `createRequestError` (Phase 2)
- Custom responses (PHP `HasCustomResponses`) are produced by a connector/request `responseFactory` config hook, not by subclassing `Response`.

### `src/http/senders/fetchSender.ts`
A sender is just an object implementing `Sender` (`{ send }`). Export a ready `fetchSender` and a `createFetchSender(opts?)` factory:
- `send(pending): Promise<Response>`:
  - `const { url, init } = pending.createFetchRequest()`
  - apply config-derived options (timeout via `AbortController` — full timeout handling in Phase 4 `hasTimeout`; basic abort wiring here)
  - `try { const res = await fetch(url, init) } catch (e) { throw new FatalRequestError(e, pending) }` (network failure → reject)
  - return `await (pending.getResponseFactory())(res, pending, init)` — **never throws on 4xx/5xx**

### `src/config.ts`
Global config (lazy, no module-init side effects), exposed as functions, not a class: `globalMiddleware()`, default timeouts, default sender, global mock client slot (used Phase 6). Used via getters/functions.

### `src/helpers/urlHelper.ts`
`joinUrl(base, endpoint, allowOverride)` — port of `URLHelper::join`: if endpoint is absolute and override allowed, use it; else join with single `/`.

## Tests (`tests/http/`)
- Spin up a local server with Node `http.createServer` in a vitest fixture (`tests/support/testServer.ts`).
- `roundtrip.test.ts`: `send(connector, request)` GET returns 200 + json body readable via `response.json()`; POST with `jsonBody` sends correct `Content-Type` + body; query merge (connector + request) reflected in received URL; header merge precedence (request overrides connector via `withHeaders`/config); 404 resolves (no throw) and `response.failed()` true, `response.toError()` returns `NotFoundError` / `isNotFoundError`; network failure (bad port) rejects with `FatalRequestError`.

## Done criteria
- Real GET/POST against the local server pass via `send(connector, request)`.
- Precedence (headers/query) verified by server echo.
- 4xx resolves without throwing; `.throw()` opt-in throws the mapped error.
- typecheck + build clean.

## Reference
- `../saloon/src/Http/PendingRequest.php` (the heart), `Connector.php`, `Request.php`, `Response.php`
- `../saloon/src/Http/PendingRequest/*.php` (tap implementations)
- `../saloon/src/Http/Senders/GuzzleSender.php`
- `../saloon/src/Helpers/URLHelper.php`

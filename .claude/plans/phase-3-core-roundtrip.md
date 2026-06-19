# Phase 3 — Core round-trip (the usable milestone)

## Goal
A real HTTP request works end-to-end: instantiate a connector + request, `await connector.send(request)`, get a `Response` you can read. This is the spine of the library. No retries, plugins, auth, or mocking yet (stubs/hooks in place).

## Files

### `src/http/Connector.ts` (abstract)
- `abstract resolveBaseUrl(): string`
- protected hooks (overridable, default empty): `defaultHeaders()`, `defaultQuery()`, `defaultConfig()`, `defaultAuth(): Authenticator | undefined`, `defaultBody(): BodyRepository | undefined`, `plugins(): Plugin[]`
- lazy getters: `get headers()`, `get query()`, `get config()` (ArrayStore), `get middleware()` (MiddlewarePipeline), `get delay()` (IntegerStore)
- `authenticate(auth): this`, `getAuthenticator()`
- `boot(pending): void` (no-op default hook)
- `handleFetchRequest(init: RequestInit, pending): RequestInit` (identity default)
- `get sender(): Sender` (lazy, defaults to `new FetchSender()`); `defaultSender()` override hook
- `async send<T>(request: Request<T>, mockClient?): Promise<Response<T>>` — Phase 3 version: build PendingRequest, call sender (or fake), run response pipeline, return. (Retry loop added in Phase 5.)
- `createPendingRequest(request, mockClient?): PendingRequest`

### `src/http/Request.ts` (abstract, generic `<TDto = unknown>`)
- `method: Method` (instance field)
- `abstract resolveEndpoint(): string`
- same protected default hooks + lazy getters as Connector
- `allowBaseUrlOverride?: boolean`
- `boot(pending)`, `handleFetchRequest(init, pending)`
- DTO hook: `createDtoFromResponse(response): TDto | undefined` (default undefined)

### `src/http/PendingRequest.ts`
Mirror `../saloon/src/Http/PendingRequest.php` constructor pipeline. Constructor takes `(connector, request, mockClient?)` and runs **synchronously** up to where async is needed; but since taps + pipeline can be async, prefer a `static async create(connector, request, mockClient?)` factory that does:
1. `this.url = joinUrl(connector.resolveBaseUrl(), request.resolveEndpoint(), allowOverride)`
2. `this.method = request.method`
3. resolve authenticator: `request.getAuthenticator() ?? connector.getAuthenticator()`
4. resolve mockClient: arg ?? request ?? connector ?? global
5. `middleware.merge(Config.globalMiddleware())`; register `determineMockResponse` (stub in Phase 3 — always no-op until Phase 6)
6. taps in order: `bootPlugins → mergeRequestProperties → mergeBody → mergeDelay → authenticate → bootConnectorAndRequest`
7. register `validateProperties` + `delay` (delay is no-op until Phase 5)
8. `await middleware.executeRequestPipeline(this)`
- State + accessors: `connector`, `request`, `url`/`getUrl`/`setUrl`, `method`/`setMethod`, `headers/query/config/middleware/delay` (own stores, populated by merge taps), `body`/`setBody`, `getAuthenticator`, `hasFakeResponse()`/`getFakeResponse()`/`setFakeResponse()`, `getResponseClass()` (request → connector → default `Response`).
- `createFetchRequest(): { url: string; init: RequestInit }`:
  - build URL with merged query (existing URL query + `query` store, store wins) via `URL`/`URLSearchParams`
  - headers from `headers` store (case-insensitive handling here)
  - body: if `body` && not empty → `toRequestBody()`, set `init.body`, set `Content-Type` if returned non-null and not already set; if `contentType === null` (multipart) **remove** any Content-Type so fetch sets the boundary
  - run `connector.handleFetchRequest` then `request.handleFetchRequest`
- `executeResponsePipeline(response)`, `executeFatalPipeline(e)` delegate to middleware.

### `src/http/pending/` taps (Phase 3 subset)
- `bootPlugins.ts` — `for (p of connector.plugins()) p.boot(pending); for (p of request.plugins()) p.boot(pending)`
- `mergeRequestProperties.ts` — merge headers/query/config (connector then request; request wins) into pending's stores; `pending.middleware.merge(connector.middleware).merge(request.middleware)`
- `mergeBody.ts` — clone connector/request bodies; enforce same constructor; request wins; if both `MergeableBody`, `connectorBody.merge(requestBody.all())`; `pending.setBody(...)`
- `mergeDelay.ts` — set from connector, override with request if set
- `authenticate.ts` — `pending.getAuthenticator()?.set(pending)`
- `bootConnectorAndRequest.ts` — `connector.boot(pending); request.boot(pending)`

### `src/http/middleware/validateProperties.ts`
Stub that no-ops (or validates required body presence). Real validation minimal in Phase 3.

### `src/http/Response.ts` (generic `<TDto = unknown>`)
Wrap the native `fetch` `Response`. Phase 3 surface (rest in Phase 4):
- `static async fromFetchResponse(res: globalThis.Response, pending, fetchRequest, cause?)` — **buffer the body once** (`await res.text()` / `arrayBuffer()`) since fetch bodies are single-use; store the text. (JS has no seekable streams; buffering is the pragmatic port of PHP's stream handling.)
- `status(): number`, `headers(): ArrayStore`, `body(): string`
- `getPendingRequest()`, `getConnector()`, `getRequest()`, `getFetchResponse()`
- `json<T>()` minimal (full keyed overloads in Phase 4)
- `successful()/failed()` minimal (full set in Phase 4)
- `throw()` and `toException()` wired to `createRequestException` (Phase 2)

### `src/http/senders/FetchSender.ts`
- `async send(pending): Promise<Response>`:
  - `const { url, init } = pending.createFetchRequest()`
  - apply config-derived options (timeout via `AbortController` — full timeout handling in Phase 4 `hasTimeout`; basic abort wiring here)
  - `try { const res = await fetch(url, init) } catch (e) { throw new FatalRequestException(e, pending) }` (network failure → reject)
  - return `await Response.fromFetchResponse(res, pending, init)` — **never throws on 4xx/5xx**

### `src/config.ts`
Global config singleton (lazy, no module-init side effects): `globalMiddleware()`, default timeouts, default sender, global mock client slot (used Phase 6). Used via getters.

### `src/helpers/urlHelper.ts`
`joinUrl(base, endpoint, allowOverride)` — port of `URLHelper::join`: if endpoint is absolute and override allowed, use it; else join with single `/`.

## Tests (`tests/http/`)
- Spin up a local server with Node `http.createServer` in a vitest fixture (`tests/support/testServer.ts`).
- `roundtrip.test.ts`: GET returns 200 + json body readable via `response.json()`; POST with `jsonBody` sends correct `Content-Type` + body; query merge (connector + request) reflected in received URL; header merge precedence (request overrides connector); 404 resolves (no throw) and `response.failed()` true, `response.toException()` returns `NotFoundException`; network failure (bad port) rejects with `FatalRequestException`.

## Done criteria
- Real GET/POST against the local server pass.
- Precedence (headers/query) verified by server echo.
- 4xx resolves without throwing; `.throw()` opt-in throws the mapped exception.
- typecheck + build clean.

## Reference
- `../saloon/src/Http/PendingRequest.php` (the heart), `Connector.php`, `Request.php`, `Response.php`
- `../saloon/src/Http/PendingRequest/*.php` (tap implementations)
- `../saloon/src/Http/Senders/GuzzleSender.php`
- `../saloon/src/Helpers/URLHelper.php`

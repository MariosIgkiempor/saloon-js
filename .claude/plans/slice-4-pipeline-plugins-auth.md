# Slice 4 — Middleware pipeline, plugins & auth

> **API style:** functional, no classes — see `api-style.md`. The pipeline is a
> **factory**; plugins and authenticators are **factory functions** returning
> objects that satisfy the `Plugin` / `Authenticator` contracts.

## Goal
Make the request lifecycle **extensible**: the full middleware pipeline (ordering
+ merge), the boot/plugin/auth taps that run through it, and the built-in plugins
and authenticators. After this slice users can do `acceptsJson()`, `tokenAuth(...)`,
custom middleware, and `withAuth`/`withMiddleware` per call — all verified by
server echo.

## Example (consumer API)
```ts
import {
  defineConnector, defineRequest, send, Method,
  acceptsJson, hasTimeout, alwaysThrowOnErrors,
  tokenAuth, basicAuth, withAuth, withMiddleware,
} from 'saloon-js';

const api = defineConnector({
  baseUrl: 'https://api.example.com',
  auth: tokenAuth(process.env.TOKEN ?? ''),          // Authorization: Bearer …
  plugins: [
    acceptsJson(),                                    // Accept: application/json
    hasTimeout({ request: 5000 }),                    // AbortController after 5s
    alwaysThrowOnErrors(),                            // make failed responses throw
  ],
  // Custom middleware registered against the pipeline:
  middleware: (pipe) => {
    pipe.onRequest((p) => { p.headers.add('X-Request-Id', crypto.randomUUID()); });
    pipe.onResponse((r) => { console.log(`${r.status()} ${r.getPendingRequest().url}`); });
  },
});

const getThing = (id: string) => defineRequest({ method: Method.GET, endpoint: `/things/${id}` });

// Per-call auth override (beats connector/request auth) — no subclass.
await send(api, withAuth(getThing('1'), basicAuth('user', 'pass')));

// Ad-hoc middleware for a single call.
await send(api, withMiddleware(getThing('1'), (pipe) => pipe.onRequest(logTiming)));
```

## Files

### `src/helpers/middlewarePipeline.ts` (the full version)
Port of `MiddlewarePipeline.php`, as a factory (closure over three ordered lists:
request / response / fatal). Each pipe = `{ name?, order?: PipeOrder, callable }`.
- `createMiddlewarePipeline(): MiddlewarePipeline` (+ export the interface)
- `onRequest(fn, name?, order?)`, `onResponse(fn, name?, order?)`,
  `onFatalException(fn, name?, order?)` — each returns self for chaining.
- `merge(other)`
- `executeRequestPipeline(pending): Promise<PendingRequest>` — runs in order; a
  pipe returning a `FakeResponse` sets it on pending and **continues** remaining
  request pipes (confirm against PHP semantics, document); awaits async pipes.
- `executeResponsePipeline(response): Promise<Response>` — each pipe may return a
  replacement Response or void.
- `executeFatalPipeline(e): Promise<void>`.
- Ordering: `PipeOrder.First` prepends, `Last` appends, default appends in
  registration order. (Fold PHP's separate `Pipeline` helper inline — no empty
  abstraction.)

### `PipeOrder` enum (added now — first used here)
Add `export enum PipeOrder { First = 'first', Last = 'last' }` to `src/enums.ts`;
the pipeline's ordering and `alwaysThrowOnErrors` are its first consumers.

### Wire the pipeline into the request lifecycle
- `pendingRequest` gains a `middleware` pipeline and runs the tap list it needs now:
  `bootPlugins → mergeRequestProperties → mergeBody → authenticate →
  bootConnectorAndRequest`, then registers `validateProperties`, then
  `await middleware.executeRequestPipeline(pending)`. (The `mergeDelay` tap and the
  `delay` middleware are added in Slice 5 with the rest of the delay machinery.)
- `send` now runs `response = await pending.executeResponsePipeline(response)` after
  the sender returns, and `executeFatalPipeline` on transport failure.
- Config gains `middleware?: (pipeline) => void` and `boot?: (pending) => void` on
  both connector and request; `mergeRequestProperties` also merges the connector
  then request pipelines into `pending.middleware`.

### Taps `src/http/pending/` (plain functions `(pending) => void`)
- `bootPlugins.ts` — `for (p of connector.plugins) p.boot(pending); for (p of request.plugins) p.boot(pending)`
- `authenticate.ts` — `pending.getAuthenticator()?.set(pending)`
- `bootConnectorAndRequest.ts` — `connector.boot?.(pending); request.boot?.(pending)`
- `src/http/middleware/validateProperties.ts` — minimal (validate required body
  presence); real validation stays light.

### Config + transformers grow
- Add `auth?`, `plugins?`, `middleware?`, `boot?`, `handleFetchRequest?` to
  `ConnectorConfig`/`RequestConfig` (value or thunk where it makes sense).
- Normalized `Connector`/`Request` expose resolved `auth`, `plugins`, the pipeline
  registrar, `boot`, `handleFetchRequest`.
- Auth resolution order in `pendingRequest`: `options.auth ?? request.auth ?? connector.auth`.
- Per-call override `withAuth(target, auth)` and `withMiddleware(target, fn)` added
  to `transformers.ts`.
- `createFetchRequest` runs the connector then request `handleFetchRequest(init, pending)` hooks.

### Array store grows
- Add `add(key, value)` to `createArrayStore` — first used by `acceptsJson()` below.

### Plugins `src/plugins/` (each a factory returning `Plugin`)
- `acceptsJson()` → `{ boot(p) { p.headers.add('Accept', 'application/json') } }`
- `hasTimeout({ connect?, request? })` → `{ boot(p) { merge into p.config } }`; the
  fetch sender reads these to drive `AbortController` (full timeout wiring here:
  `connectTimeout`/`timeout`, defaults from `config`).
- `alwaysThrowOnErrors()` → `{ boot(p) { p.middleware.onResponse(r => r.throw(), 'alwaysThrowOnErrors', PipeOrder.Last) } }`
- Used via `plugins: [acceptsJson(), hasTimeout({ request: 5000 })]`.

### Auth `src/auth/` (each a factory returning `Authenticator` = `{ set(pending) }`)
- `tokenAuth(token, prefix = 'Bearer')` → `Authorization: <prefix> <token>`
- `basicAuth(username, password)` → `Authorization: Basic <base64>` (Node `Buffer`,
  guard for browser)
- `headerAuth(accessToken, headerName = 'Authorization')`
- `queryAuth(name, value)` → adds to `p.query`
- `multiAuth(...authenticators)` → calls each `set`

### Fetch sender — timeout
Complete `AbortController` timeout handling driven by `hasTimeout`/config
(`connectTimeout` vs `timeout`). On abort → `FatalRequestError`.

## Tests (`tests/`)
- `tests/helpers/middlewarePipeline.test.ts`: request pipes run in registration
  order; `First`/`Last` honored; a request pipe returning a fake response stops the
  sender (assert via flag) but remaining request pipes still run (document the PHP
  semantics); response pipes replace or pass through; `merge` concatenates
  preserving order; async pipes awaited.
- `tests/plugins.test.ts`: `acceptsJson` sets header; `hasTimeout` against the
  server's `/slow?ms=` route with a small timeout → `FatalRequestError`;
  `alwaysThrowOnErrors` against `/status/500` throws `ServerError` from `send()`.
- `tests/auth.test.ts`: each authenticator sets the right header/query (server echo
  or pending assertion); `withAuth` per-call override beats connector/request.

## Done criteria
- Pipeline ordering + async + merge specs green; lifecycle runs through it.
- All plugins/auth factories exported from barrels; server-echo verified.
- `alwaysThrowOnErrors` + `hasTimeout` behaviors covered.
- typecheck + lint + build clean.

## Reference
- `../saloon/src/Helpers/{MiddlewarePipeline,Pipeline}.php`
- `../saloon/src/Contracts/{Sender,Authenticator,Plugin,RequestMiddleware,ResponseMiddleware}.php`
- `../saloon/src/Traits/Plugins/{AcceptsJson,HasTimeout,AlwaysThrowOnErrors}.php`
- `../saloon/src/Http/Auth/*.php`
- `../saloon/src/Http/PendingRequest/{BootPlugins,Authenticate,...}.php`

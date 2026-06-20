# Slice 1 — Walking skeleton: GET round-trip

> **API style:** functional, no classes — see `api-style.md`.

## Goal
A real HTTP **GET** works end-to-end: build a connector + request with the define
functions, `await send(connector, request)`, read JSON off the `Response`. Plus a
buildable/lintable/typed package. After this slice you have the spine everything
else hangs off and a live feedback loop (a local test server).

## Example (consumer API)
```ts
import { defineConnector, defineRequest, send, Method, isFatalRequestError } from 'saloon-js';

// A connector is a value, not a class.
const httpbin = defineConnector({
  baseUrl: 'https://httpbin.org',
  headers: { 'X-App': 'demo' },
});

// A request is a factory returning config (wrap it for params).
const getJson = () => defineRequest({ method: Method.GET, endpoint: '/json' });
const search = (q: string) =>
  defineRequest({ method: Method.GET, endpoint: '/get', query: { q } });

// send() is a free function.
const res = await send(httpbin, getJson());
res.status();        // 200
res.json();          // parsed body
res.headers().get('content-type');

await send(httpbin, search('saloon'));   // connector + request headers/query reach the server

// Transport failure rejects (it does not resolve to a Response).
try {
  await send(defineConnector({ baseUrl: 'http://localhost:1' }), getJson());
} catch (e) {
  if (isFatalRequestError(e)) console.error('network down');
}
```

## Toolchain note
Scaffolding (pnpm/nvm/Biome/tsdown/vitest, `tsconfig`, `@/` alias) is already in
place. Don't re-init.

## Files (minimum subset only — later slices complete these)

### `src/enums.ts`
```ts
export enum Method {
  GET = 'GET', HEAD = 'HEAD', POST = 'POST', PUT = 'PUT',
  PATCH = 'PATCH', DELETE = 'DELETE', OPTIONS = 'OPTIONS',
  CONNECT = 'CONNECT', TRACE = 'TRACE',
}
```
(`PipeOrder` is **not** defined here — it's added in Slice 4 when the middleware
pipeline that uses it is built.)

### `src/repositories/arrayStore.ts`
Port of `../saloon/src/Repositories/ArrayStore.php`, as a **factory** (closure over
a private `Record<string, T>`). Add only the methods this slice uses:
- `createArrayStore<T = unknown>(data?: Record<string, T>): ArrayStore<T>`
- `all()`, `get(key, default?)`, `set(data)`, `merge(...arrays)` (later wins, like
  PHP `array_merge`). Export the `ArrayStore<T>` **interface** with just these.
- The remaining ArrayStore methods are added by the slice that first needs them:
  `has` (Slice 2, content-type check), `add` (Slice 4, plugins), and
  `remove`/`isEmpty`/`isNotEmpty` wherever a later slice first uses them.
- Header case-insensitivity is **not** handled here — it's done at the
  PendingRequest/FetchSender boundary (Slice 2/4). Keep this store literal.

### `src/contracts/` (interfaces only — declare only the fields this slice uses)
Each interface carries **only** the members Slice 1 reads; later slices extend the
interface when they add the fields/methods they need (no forward-declared members).
- `Sender.ts`: `interface Sender { send(pending: PendingRequest): Promise<Response>; }`
- `Connector.ts`, `Request.ts`: the **normalized values** out of `defineConnector`/
  `defineRequest`: `baseUrl`/`endpoint` (resolved), `method`, `headers`/`query`
  stores, `sender`, `name?`.
- `ConnectorConfig` / `RequestConfig<TDto>`: the **input** types:
  `baseUrl`/`endpoint` (string or thunk), `headers?`/`query?`, `sender?`, `name?`.
- `Response.ts`: only the members Slice 1's response factory exposes (see below).
- Use `import type` for forward refs (`PendingRequest`, `Response`) to avoid cycles.
- Barrel `src/contracts/index.ts`.

### `src/errors/` (two classes only — the rest in Slice 3)
- `SaloonError.ts`: `class SaloonError extends Error` (set `this.name = new.target.name`).
- `FatalRequestError.ts`: `class FatalRequestError extends SaloonError` — carries
  `pendingRequest`, sets `cause`. Thrown by the sender on transport failure.
- `predicates.ts`: `isSaloonError`, `isFatalRequestError` only for now.
- Barrel `src/errors/index.ts`. (Slice 3 fills in `RequestError` + the hierarchy.)

### `src/helpers/urlHelper.ts`
`joinUrl(base, endpoint, allowOverride)` — port of `URLHelper::join`: absolute
endpoint + override allowed → use it; else join with a single `/`.

### `src/config.ts`
Global config as **functions**, no module-init side effects. Slice 1 needs only the
default sender. Default timeouts are added in Slice 4 (with `hasTimeout`) and the
global mock slot in Slice 6 — don't add them before those slices use them.

### `src/http/defineConnector.ts`
`defineConnector(config: ConnectorConfig): Connector` — normalize + **freeze**.
Slice-1 fields only: `baseUrl` (string|thunk), `headers?`, `query?`, `sender?`
(default `fetchSender`), `name?`. Later slices add `auth/body/plugins/middleware/
boot/retry/oauth/tokens/...`.

### `src/http/defineRequest.ts` (generic `<TDto = unknown>`)
`defineRequest<TDto>(config: RequestConfig<TDto>): Request<TDto>`. Slice-1 fields:
`method`, `endpoint` (string|thunk), `headers?`, `query?`, `allowBaseUrlOverride?`,
`name?`. (Usually wrapped in a user factory for params.)

### `src/http/pendingRequest.ts`
The one intentionally-**mutable** object (per-send, never shared), as a factory.
Slice-1 build pipeline (no middleware pipeline yet — keep it inline and thin):
1. `pending.url = joinUrl(resolveBaseUrl(connector), resolveEndpoint(request), allowOverride)`
2. `pending.method = request.method`
3. merge headers/query: connector then request (request wins) into pending's stores
4. expose `getResponseFactory()` → default `responseFromFetch`
- `createFetchRequest(): { url, init }`: merge query (existing URL query + `query`
  store, store wins) via `URL`/`URLSearchParams`; headers from the `headers` store
  with **case-insensitive** handling here.
- No taps/middleware/auth/body/plugins yet — those arrive in Slices 2–4 and this
  file grows a real tap list then.

### `src/http/response.ts` (generic `<TDto = unknown>`)
Factory wrapping native `fetch` `Response` (buffer the body once — fetch bodies
are single-use). Slice-1 surface:
- `responseFromFetch(res, pending, fetchRequest, cause?): Promise<Response>`
- `status()`, `headers(): ArrayStore`, `body(): string`, `json<T>()` (minimal)
- `getPendingRequest()`, `getRequest()`, `getConnector()`, `getFetchResponse()`
- Status helpers (`successful`/`failed`/…), `throw()`/`toError()`, and the keyed
  `json` overloads are **not** added here — Slice 3 adds them when it builds the
  error model and the failure-inspection flow that use them.

### `src/http/senders/fetchSender.ts`
A sender is just `{ send }`. Export `fetchSender` and `createFetchSender(opts?)`:
- `const { url, init } = pending.createFetchRequest()`
- `try { res = await fetch(url, init) } catch (e) { throw new FatalRequestError(e, pending) }`
- `return await pending.getResponseFactory()(res, pending, init)` — **never throws
  on 4xx/5xx** (status handling is Slice 3).

### `src/http/send.ts`
`send<TDto>(connector, request, options?): Promise<Response<TDto>>` — the free
entrypoint. Slice-1 version: `createPendingRequest` → `connector.sender.send` →
return. No retry loop (Slice 5), no response pipeline yet (Slice 4), no mock
(Slice 6). Also export curried `send.with(connector)`.

## Tests (`tests/`)
- `tests/support/testServer.ts` — **already implemented** (zero-dependency
  `node:http` fixture; see the file header). The **one shared server** every slice
  reuses: `startTestServer()` → `{ url, requests, maxInFlight, reset(), close() }`.
  Routes: `*` echoes `{ method, path, query, headers, body, rawBody }`;
  `/status/:code`; `/slow?ms=`; `/concurrent?ms=`; `/flaky?key=&fails=&status=`.
  Start in `beforeAll`, `await server.close()` in `afterAll`, `server.reset()`
  between tests. (Bodies reflected raw, so multipart needs no parser.)
- `tests/http/getRoundtrip.test.ts`:
  - GET returns 200, JSON readable via `response.json()`.
  - connector `headers`/`query` reach the server (assert via the echo body).
  - request `headers`/`query` reach the server.
  - network failure (bad port) **rejects** with `FatalRequestError` /
    `isFatalRequestError`.
- `tests/repositories/arrayStore.test.ts`: defaults; `merge` precedence; `get`
  default. (Cover `has`/`add`/etc. in the slice that adds each method.)

## Done criteria
- Real GET against the local server passes via `send(connector, request)`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` clean; `pnpm test` green.
- `src/index.ts` exports (at least): `defineConnector`, `defineRequest`, `send`,
  `Method`, `fetchSender`, `createFetchSender`, `isFatalRequestError`, and the
  `Connector`/`Request`/`Response`/`Sender` types.

## Reference
- `../saloon/src/Http/PendingRequest.php` (the heart — but only the URL/method/
  header/query parts for this slice), `Connector.php`, `Request.php`, `Response.php`
- `../saloon/src/Http/Senders/GuzzleSender.php`
- `../saloon/src/Helpers/URLHelper.php`
- `../saloon/src/Repositories/ArrayStore.php`, `../saloon/src/Enums/Method.php`
- `../saloon/src/Exceptions/{SaloonException,FatalRequestException}.php`

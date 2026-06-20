# Phase 4 — Plugins, auth, body completion

> **API style:** functional, no classes — see `api-style.md`. Plugins, authenticators,
> and body repos are all **factory functions** returning objects that satisfy the
> `Plugin` / `Authenticator` / `BodyRepository` interfaces. No class variants.

## Goal
Fill out the developer-facing surface: the built-in plugins, all authenticators, the remaining body types, and the full `Response` reading API.

## Files

### `src/plugins/` (each a factory returning `Plugin`)
- `acceptsJson.ts` — `acceptsJson()` → `{ boot(p) { p.headers.add('Accept', 'application/json') } }`
- `hasTimeout.ts` — `hasTimeout({ connect?, request? })` → `{ boot(p) { merge into p.config (connectTimeout, timeout) } }`; the fetch sender reads these to drive `AbortController`. Defaults from `config`.
- `alwaysThrowOnErrors.ts` — `alwaysThrowOnErrors()` → `{ boot(p) { p.middleware.onResponse(r => r.throw(), 'alwaysThrowOnErrors', PipeOrder.Last) } }`
- Used via `plugins: [acceptsJson(), hasTimeout({ request: 5000 })]` on the connector/request config.
- Optional parity extras (note, implement if low-cost): JSON-body helpers are NOT plugins here — body is set via the `body` config field returning a repo (see below).

### `src/auth/` (each a factory returning an `Authenticator` — `{ set(pending) }`)
- `tokenAuth(token, prefix = 'Bearer')` → `Authorization: <prefix> <token>`
- `basicAuth(username, password)` → `Authorization: Basic <base64>` (use `btoa` or `Buffer` — pick `Buffer` for Node-first, guard for browser)
- `headerAuth(accessToken, headerName = 'Authorization')`
- `queryAuth(name, value)` → adds to `p.query`
- `multiAuth(...authenticators)` — composes multiple authenticators (calls each `set`)
- No class exports — the factory return value (typed `Authenticator`) is the whole surface.

### Body repositories (complete the set under `src/repositories/body/`)
Each is a **factory** returning a `BodyRepository` object (closure over the data); a `kind` string discriminant replaces "same constructor" identity checks from PHP.
- `jsonBody(obj)` (mergeable) — `toRequestBody` → `{ body: JSON.stringify(data), contentType: 'application/json' }`
- `formBody(obj)` (mergeable) — `{ body: new URLSearchParams(data), contentType: 'application/x-www-form-urlencoded' }`
- `multipartBody(values)` (mergeable) — stores `MultipartValue[] = { name, value: string|Blob, filename?, headers? }`; `toRequestBody` builds `FormData`, returns `{ body: form, contentType: null }`; object exposes `add(name, contents, filename?, headers?)`, `attach(value)`
- `stringBody(str, contentType?)` — raw string + explicit contentType
- `streamBody(stream, contentType?)` — wraps `ReadableStream`/`Blob` for upload
- Connectors/requests opt in via the `body` config field returning one of these (was `defaultBody()`).

### `src/http/response.ts` (complete the factory's returned object)
- `json<T = unknown>(): T`, with keyed overloads `json<K extends keyof T>(key: K, default?): T[K]` (dot-path support like PHP `json($key)` — implement simple dot-path getter)
- `object<T>()`, `body(): string`, `header(name): string | null`, `headers(): ArrayStore`
- `collect()` — optional; return array/Map without a Laravel-style dep (document divergence; maybe omit or return plain array)
- status helpers: `successful()` (200–299), `ok()` (200), `redirect()` (300–399), `failed()` (>=400 or custom), `clientError()` (400–499), `serverError()` (>=500)
- `onError(cb)` — calls `cb(this)` if failed, returns `this`
- `dto(): TDto | undefined` (calls request's `createDtoFromResponse`), `dtoOrFail()` (returns dto, throws if response failed)
- `isMocked()/isCached()` flags (set later by faking)
- `saveBodyToFile(path)` — write buffered body to disk (Node `fs`)

## Tests (`tests/`)
- `plugins.test.ts`: acceptsJson sets header; hasTimeout sets config + sender aborts after timeout (use a slow local route + small timeout → `FatalRequestError`); alwaysThrowOnErrors makes a 500 throw `ServerError` from `send()`.
- `auth.test.ts`: each authenticator sets the right header/query (assert on server echo or on pending).
- `body.test.ts`: json/form/multipart produce correct Content-Type (multipart: boundary present, no manual Content-Type) and correct received payload; mergeable bodies merge connector→request; same-`kind` enforcement throws on mismatch.
- `response.test.ts`: `json` keyed + dot-path; status helper boundaries; `dto()`/`dtoOrFail()`; `onError`.

## Done criteria
- All plugins/auth/body factories exported from barrels.
- Server-echo tests confirm headers/body/query for each auth + body type.
- Response reading API fully specced + green.

## Reference
- `../saloon/src/Traits/Plugins/{AcceptsJson,HasTimeout,AlwaysThrowOnErrors}.php`
- `../saloon/src/Http/Auth/*.php`
- `../saloon/src/Repositories/Body/*.php`, `../saloon/src/Data/MultipartValue.php`
- `../saloon/src/Http/Response.php`

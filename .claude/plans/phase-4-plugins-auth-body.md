# Phase 4 — Plugins, auth, body completion

## Goal
Fill out the developer-facing surface: the built-in plugins, all authenticators, the remaining body types, and the full `Response` reading API.

## Files

### `src/plugins/` (each a factory returning `Plugin`)
- `acceptsJson.ts` — `boot(p) { p.headers.add('Accept', 'application/json') }`
- `hasTimeout.ts` — `hasTimeout({ connect?, request? })` → merges into `p.config` (`connectTimeout`, `timeout`); FetchSender reads these to drive `AbortController`. Defaults from `Config`.
- `alwaysThrowOnErrors.ts` — `boot(p) { p.middleware.onResponse(r => r.throw(), 'alwaysThrowOnErrors', PipeOrder.Last) }`
- Optional parity extras (note, implement if low-cost): `hasJsonBody`-style helpers are NOT plugins here — body is set via `defaultBody()` returning a repo (see below).

### `src/auth/` (each implements `Authenticator`)
- `TokenAuthenticator.ts` — `{ token, prefix='Bearer' }` → `Authorization: <prefix> <token>`
- `BasicAuthenticator.ts` — `{ username, password }` → `Authorization: Basic <base64>` (use `btoa` or `Buffer` — pick `Buffer` for Node-first, guard for browser)
- `HeaderAuthenticator.ts` — `{ accessToken, headerName='Authorization' }`
- `QueryAuthenticator.ts` — `{ name, value }` → adds to `p.query`
- `MultiAuthenticator.ts` — composes multiple authenticators
- factory helpers exported (e.g. `tokenAuth(...)`) for ergonomic use, plus the classes.

### Body repositories (complete the set under `src/repositories/body/`)
- `JsonBodyRepository.ts` (mergeable) — `toRequestBody` → `{ body: JSON.stringify(data), contentType: 'application/json' }`
- `FormBodyRepository.ts` (mergeable) — `{ body: new URLSearchParams(data), contentType: 'application/x-www-form-urlencoded' }`
- `MultipartBodyRepository.ts` (mergeable) — stores `MultipartValue[] = { name, value: string|Blob, filename?, headers? }`; `toRequestBody` builds `FormData`, returns `{ body: form, contentType: null }`; `add(name, contents, filename?, headers?)`, `attach(value)`
- `StringBodyRepository.ts` — raw string + explicit contentType
- `StreamBodyRepository.ts` — wraps `ReadableStream`/`Blob` for upload
- Ergonomic factories: `jsonBody(obj)`, `formBody(obj)`, `multipartBody(values)`, `stringBody(str, contentType?)`.
- Connectors/requests opt in by overriding `protected defaultBody()` to return one of these.

### `src/http/Response.ts` (complete)
- `json<T = unknown>(): T`, with keyed overloads `json<K extends keyof T>(key: K, default?): T[K]` (dot-path support like PHP `json($key)` — implement simple dot-path getter)
- `object<T>()`, `body(): string`, `header(name): string | null`, `headers(): ArrayStore`
- `collect()` — optional; return array/Map without a Laravel-style dep (document divergence; maybe omit or return plain array)
- status helpers: `successful()` (200–299), `ok()` (200), `redirect()` (300–399), `failed()` (>=400 or custom), `clientError()` (400–499), `serverError()` (>=500)
- `onError(cb)` — calls `cb(this)` if failed, returns `this`
- `dto(): TDto | undefined` (calls request's `createDtoFromResponse`), `dtoOrFail()` (returns dto, throws if response failed)
- `isMocked()/isCached()` flags (set later by faking)
- `saveBodyToFile(path)` — write buffered body to disk (Node `fs`)

## Tests (`tests/`)
- `plugins.test.ts`: acceptsJson sets header; hasTimeout sets config + sender aborts after timeout (use a slow local route + small timeout → `FatalRequestException`); alwaysThrowOnErrors makes a 500 throw `ServerException` from `send()`.
- `auth.test.ts`: each authenticator sets the right header/query (assert on server echo or on pending).
- `body.test.ts`: json/form/multipart produce correct Content-Type (multipart: boundary present, no manual Content-Type) and correct received payload; mergeable bodies merge connector→request; same-type enforcement throws on mismatch.
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

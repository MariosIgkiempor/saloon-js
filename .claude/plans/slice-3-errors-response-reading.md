# Slice 3 — Error model & full response reading

> **⚠️ Revised direction (PR #4):** the error model is now **return-based**, built
> on the internal `Result<T, E>` primitive (`src/result.ts`). `send` throws **only**
> the network `FatalRequestError`; nothing else throws. The thrown status-class
> hierarchy + per-status predicates (`isNotFoundError`, `createRequestError`, …)
> described below are **superseded** — see the "Error handling" section of
> `api-style.md`. When this slice is implemented, rework it around `Result` +
> `response.failed()`/inspection rather than the throw-based hierarchy below.

> **API style:** functional, no classes — see `api-style.md`. **Errors are the
> deliberate carve-out**: real `class … extends Error`, but constructed by a
> factory and discriminated by **predicate helpers** as the primary API. Users
> never author/subclass them — only catch them. Naming uses the JS-idiomatic
> `*Error` suffix (not PHP `*Exception`) so class names mirror predicate names.

## Goal
Complete the typed-error hierarchy and the full `Response` reading API. The core
**never throws** on a 4xx/5xx by default — errors are *returned* by
`response.toError()` and only *thrown* on opt-in (`response.throw()`,
`alwaysThrowOnErrors` in Slice 4) or transport failure (`FatalRequestError`,
already in Slice 1). This slice makes "inspect the failure" a first-class flow.

## Example (consumer API)
```ts
import { send, isNotFoundError, isServerError, isRequestError } from 'saloon-js';

// 4xx/5xx resolve — they do NOT throw by default.
const res = await send(api, getUser('ghost'));   // 404
res.failed();             // true
res.successful();         // false
res.status();             // 404
res.json('error.message'); // keyed / dot-path read
res.header('x-ratelimit-remaining');

// Inspect without throwing:
const err = res.toError();     // NotFoundError | undefined
res.onError((r) => console.warn(`failed: ${r.status()}`));

// Opt in to throwing, then discriminate via predicates (not instanceof):
try {
  (await send(api, getUser('ghost'))).throw();
} catch (e) {
  if (isNotFoundError(e)) {/* 404 */}
  else if (isServerError(e)) {/* 5xx */}
  else if (isRequestError(e)) {/* other 4xx */}
}
```

## Files

### Error hierarchy `src/errors/` (extends Slice 1's `SaloonError`/`FatalRequestError`)
```
SaloonError (extends Error)              [Slice 1]
└─ RequestError          (has response, status, body excerpt)
   ├─ ClientError        (4xx fallback)
   │  ├─ UnauthorizedError (401)        ├─ MethodNotAllowedError (405)
   │  ├─ PaymentRequiredError (402)     ├─ RequestTimeoutError (408)
   │  ├─ ForbiddenError (403)           ├─ UnprocessableEntityError (422)
   │  ├─ NotFoundError (404)            └─ TooManyRequestsError (429)
   └─ ServerError        (5xx fallback)
      ├─ InternalServerError (500)
      ├─ ServiceUnavailableError (503)
      └─ GatewayTimeoutError (504)
FatalRequestError (extends SaloonError)  [Slice 1]
```

### `RequestError.ts`
- `constructor(response, message?, options?: { cause? })`
- Default message: `` `${statusText} (${status}) Response: ${bodyExcerpt}` `` —
  body truncated to `maxBodyLength = 2000`.
- Accessors: `getResponse()`, `getPendingRequest()`, `getStatus()`.

### `createRequestError.ts`
Port of `RequestExceptionHelper.php` (renamed). Internal factory used by
`Response.toError()`/`.throw()` (and the Slice-5 retry loop):
```ts
export function createRequestError(response: Response, cause?: unknown): RequestError
```
Map exact statuses (401/402/403/404/405/408/422/429/500/503/504) → specific class;
else 5xx → `ServerError`, 4xx → `ClientError`, otherwise → `RequestError`.

### `predicates.ts` (the primary discrimination API — extends Slice 1's)
Pure functions (`instanceof` internally is fine; callers use the predicate):
`isRequestError`, `isClientError`, `isServerError`, plus per-status
`isNotFoundError`, `isUnauthorizedError`, `isForbiddenError`,
`isTooManyRequestsError`, `isUnprocessableEntityError`, … (mirror each status class).
(`isSaloonError`/`isFatalRequestError` already exist from Slice 1.)

### `src/http/response.ts` — complete the reading API
Grow the Slice-1 factory's returned object:
- `json<T = unknown>(): T`, with keyed/dot-path overloads `json<K>(key, default?)`
  (simple dot-path getter, like PHP `json($key)`).
- `object<T>()`, `body(): string`, `header(name): string | null`, `headers(): ArrayStore`
- status helpers: `successful()` (200–299), `ok()` (200), `redirect()` (300–399),
  `failed()` (≥400 or custom), `clientError()` (400–499), `serverError()` (≥500)
- `onError(cb)` — calls `cb(this)` if failed, returns `this`
- `throw()` — if `failed()`, throw `createRequestError(this)`; else return `this`
- `toError()` — return `createRequestError(this)` (or undefined if not failed)
- `saveBodyToFile(path)` — write buffered body to disk (Node `fs`)
- (`isMocked()`/`isCached()` are added in Slice 6, and `dto()`/`dtoOrFail()` in
  Slice 7 — the slices that introduce the faking flags and the DTO hook they read.
  Don't add them here.)

### Custom responses
PHP `HasCustomResponses` → a `responseFactory` config hook on connector/request
(request → connector → default `responseFromFetch`). Wire the hook resolution in
`pendingRequest.getResponseFactory()` now; the field is read by the fetch sender.

## Tests (`tests/errors/`, `tests/http/`)
- `createRequestError.test.ts`: stub `Response` per status → assert instance type
  (404 → `NotFoundError`, 418 → `ClientError`, 500 → `InternalServerError`,
  599 → `ServerError`, 302 → `RequestError`).
- `requestError.test.ts`: default message format; body truncation at 2000;
  `instanceof` chain (NotFoundError ⊂ ClientError ⊂ RequestError ⊂ SaloonError).
- `predicates.test.ts`: each predicate narrows correctly; false for unrelated
  errors / non-errors.
- `response.test.ts` (live server): `json` keyed + dot-path; status-helper
  boundaries; `onError`; 404 → `response.failed()` true and `response.toError()`
  returns `NotFoundError`; `.throw()` opt-in throws the mapped error; non-failed
  `.throw()` returns `this`.
- `customResponse.test.ts`: a connector/request `responseFactory` hook is invoked
  by `getResponseFactory()` and its custom object is returned from `send` (request
  factory overrides connector). (Justifies introducing the hook in this slice —
  don't add `responseFactory` until this test exercises it.)

## Done criteria
- Full hierarchy + predicates exported from `src/errors/index.ts`.
- Mapper + message/inheritance + predicate specs green.
- Response reading API fully specced; 4xx still resolves without throwing;
  `.throw()`/`.toError()` work.
- Core throws these **only** via `.throw()`/sender wiring (grep-verify).

## Reference
- `../saloon/src/Exceptions/Request/{RequestException,ClientException,ServerException}.php`
- `../saloon/src/Exceptions/Request/Statuses/*.php`
- `../saloon/src/Helpers/RequestExceptionHelper.php`
- `../saloon/src/Http/Response.php`

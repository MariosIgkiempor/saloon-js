# Phase 2 — Error types (non-throwing by default)

> **API style:** functional, no classes — see `api-style.md`. **Errors are the
> deliberate carve-out**: they stay `class … extends Error` (a throwable must),
> but they are constructed by a factory and discriminated by **predicate
> helpers** as the primary API; `instanceof` stays available. Users never
> author/subclass them — they only catch them.
>
> **Naming:** use the JS-idiomatic `*Error` suffix (not PHP's `*Exception`) so
> class names match the predicate names (`NotFoundError` ↔ `isNotFoundError`).

## Goal
The full typed-error hierarchy as real `Error` subclasses, the status→class mapper, and the predicate helpers. Per the approved error model: **the core never throws these on a 4xx/5xx.** They are returned by `response.toError()` and only thrown when the user opts in (`response.throw()`, `alwaysThrowOnErrors()`), or when the transport fails (`FatalRequestError` rejects the `send()` promise).

## Files (`src/errors/`)

### Hierarchy
```
SaloonError (extends Error)
└─ RequestError          (has response, status, body excerpt)
   ├─ ClientError        (4xx fallback)
   │  ├─ UnauthorizedError (401)
   │  ├─ PaymentRequiredError (402)
   │  ├─ ForbiddenError (403)
   │  ├─ NotFoundError (404)
   │  ├─ MethodNotAllowedError (405)
   │  ├─ RequestTimeoutError (408)
   │  ├─ UnprocessableEntityError (422)
   │  └─ TooManyRequestsError (429)
   └─ ServerError        (5xx fallback)
      ├─ InternalServerError (500)
      ├─ ServiceUnavailableError (503)
      └─ GatewayTimeoutError (504)
FatalRequestError (extends SaloonError)  // no response; carries pendingRequest
```

### `SaloonError.ts`
`class SaloonError extends Error` — set `this.name = new.target.name` so subclasses report correctly. (TS+ES2022 target: extending `Error` works without the `Object.setPrototypeOf` hack, but include it defensively if `target` ever drops below ES2015.) These class definitions are an implementation detail behind the predicates — they are not the surface users program against.

### `RequestError.ts`
- `constructor(response: Response, message?: string, options?: { cause?: unknown })`
- Default message: `` `${statusText} (${status}) Response: ${bodyExcerpt}` `` — body truncated to `maxBodyLength = 2000`.
- Accessors: `getResponse()`, `getPendingRequest()`, `getStatus()`.

### `FatalRequestError.ts`
- `constructor(cause: Error, pendingRequest: PendingRequest)` — store `this.pendingRequest`, set `cause`.

### `createRequestError.ts`
Port of `../saloon/src/Helpers/RequestExceptionHelper.php` (renamed). Internal factory used by `Response.toError()`/`.throw()` and the retry loop:
```ts
export function createRequestError(response: Response, cause?: unknown): RequestError
```
Map exact statuses (401/402/403/404/405/408/422/429/500/503/504) → specific class; else 5xx → `ServerError`, 4xx → `ClientError`, otherwise → `RequestError`.

### `predicates.ts` (the primary discrimination API)
Pure functions, no `instanceof` required at the call site:
```ts
export const isSaloonError = (e: unknown): e is SaloonError => e instanceof SaloonError;
export const isRequestError = (e: unknown): e is RequestError => e instanceof RequestError;
export const isFatalRequestError = (e: unknown): e is FatalRequestError => ...;
export const isClientError = (e: unknown): e is ClientError => ...;
export const isServerError = (e: unknown): e is ServerError => ...;
// per-status:
export const isNotFoundError = ..., isUnauthorizedError = ..., isForbiddenError = ...,
  isTooManyRequestsError = ..., isUnprocessableEntityError = ...; // mirror each status class
```
(Implemented with `instanceof` internally — that's allowed; the point is callers use the predicate, not the class.)

## Tests (`tests/errors/`)
- `createRequestError.test.ts`: build a stub `Response` per status code, assert the returned instance type (e.g. 404 → `NotFoundError`, 418 → `ClientError`, 500 → `InternalServerError`, 599 → `ServerError`, 302 → `RequestError`).
- `requestError.test.ts`: default message format, body truncation at 2000 chars, `instanceof` chain (NotFoundError is a ClientError is a RequestError is a SaloonError).
- `predicates.test.ts`: each predicate narrows correctly and returns false for unrelated errors / non-errors.

## Done criteria
- All error classes + predicates exported from `src/errors/index.ts`.
- Mapper + message/inheritance + predicate specs green.
- No core code throws these yet (only constructed/returned) — verified by grep that only `.throw()`/sender wiring (later phases) references throwing.

## Reference
- `../saloon/src/Exceptions/Request/RequestException.php`, `ClientException.php`, `ServerException.php`
- `../saloon/src/Exceptions/Request/Statuses/*.php`
- `../saloon/src/Exceptions/FatalRequestException.php`, `SaloonException.php`
- `../saloon/src/Helpers/RequestExceptionHelper.php`

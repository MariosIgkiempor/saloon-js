# Phase 2 — Error types (non-throwing by default)

## Goal
The full typed-error hierarchy as real `Error` subclasses, plus the status→class mapper. Per the approved error model: **the core never throws these on a 4xx/5xx.** They are returned by `response.toException()` and only thrown when the user opts in (`response.throw()`, `alwaysThrowOnErrors()`), or when the transport fails (`FatalRequestException` rejects the `send()` promise).

## Files (`src/exceptions/`)

### Hierarchy
```
SaloonException (extends Error)
└─ RequestException        (has response, status, body excerpt)
   ├─ ClientException      (4xx fallback)
   │  ├─ UnauthorizedException (401)
   │  ├─ PaymentRequiredException (402)
   │  ├─ ForbiddenException (403)
   │  ├─ NotFoundException (404)
   │  ├─ MethodNotAllowedException (405)
   │  ├─ RequestTimeOutException (408)
   │  ├─ UnprocessableEntityException (422)
   │  └─ TooManyRequestsException (429)
   └─ ServerException      (5xx fallback)
      ├─ InternalServerErrorException (500)
      ├─ ServiceUnavailableException (503)
      └─ GatewayTimeoutException (504)
FatalRequestException (extends SaloonException)  // no response; carries pendingRequest
```

### `SaloonException.ts`
`class SaloonException extends Error` — set `this.name = new.target.name` so subclasses report correctly. (TS+ES2022 target: extending `Error` works without the `Object.setPrototypeOf` hack, but include it defensively if `target` ever drops below ES2015.)

### `RequestException.ts`
- `constructor(response: Response, message?: string, options?: { cause?: unknown })`
- Default message: `` `${statusText} (${status}) Response: ${bodyExcerpt}` `` — body truncated to `maxBodyLength = 2000`.
- Getters: `getResponse()`, `getPendingRequest()`, `getStatus()`.

### `FatalRequestException.ts`
- `constructor(cause: Error, pendingRequest: PendingRequest)` — store `this.pendingRequest`, set `cause`.

### `requestExceptionHelper.ts`
Port of `../saloon/src/Helpers/RequestExceptionHelper.php`.
```ts
export function createRequestException(response: Response, cause?: unknown): RequestException
```
Map exact statuses (401/402/403/404/405/408/422/429/500/503/504) → specific class; else 5xx → `ServerException`, 4xx → `ClientException`, otherwise → `RequestException`.

## Tests (`tests/exceptions/`)
- `requestExceptionHelper.test.ts`: build a stub `Response` per status code, assert the returned instance type (e.g. 404 → `NotFoundException`, 418 → `ClientException`, 500 → `InternalServerErrorException`, 599 → `ServerException`, 302 → `RequestException`).
- `requestException.test.ts`: default message format, body truncation at 2000 chars, `instanceof` chain (NotFoundException is a ClientException is a RequestException is a SaloonException).

## Done criteria
- All classes exported from `src/exceptions/index.ts`.
- Mapper + message/inheritance specs green.
- No core code throws these yet (only constructed/returned) — verified by grep that only `.throw()`/sender wiring (later phases) references throwing.

## Reference
- `../saloon/src/Exceptions/Request/RequestException.php`, `ClientException.php`, `ServerException.php`
- `../saloon/src/Exceptions/Request/Statuses/*.php`
- `../saloon/src/Exceptions/FatalRequestException.php`, `SaloonException.php`
- `../saloon/src/Helpers/RequestExceptionHelper.php`

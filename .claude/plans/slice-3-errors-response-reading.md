# Slice 3 — Error model & full response reading

> **Reworked around the return-based error model (PR #4).** The thrown
> status-class hierarchy + per-status predicates originally specced here are
> **dropped**. The error model is now built on the internal `Result<T, E>`
> primitive (`src/result.ts`). `send` throws **only** the network
> `FatalRequestError`; nothing else in the core throws a `SaloonError`. See the
> "Error handling: return-based internally, throw only the network error" section
> of `api-style.md` for the policy this slice implements.

## Goal

Complete the full `Response` reading surface and make "inspect / obtain the
failure as a value" a first-class flow — **without throwing** on 4xx/5xx. A
response with an error status is a *successful round-trip*: it comes back as a
`Response` to read. Getting the failure as a value is `response.toResult()`
(returns `Result<Response, RequestError>`). `RequestError` is **data** that lives
in the `Err` channel — `send` never throws it.

## Design (the decisions this slice settles)

### 1. Full `Response` reading surface (methods on the response object)

Grow the Slice-1 response factory's returned object. All reads are off the body
buffered once in Slice 1 (fetch bodies are single-use streams).

- `status(): number`
- `body(): string`
- `json<T = unknown>(): T` — whole body parsed as JSON.
- `json<T = unknown>(key: string, defaultValue?: T): T` — dot-path getter over the
  parsed object (PHP `json($key)` / `ArrayHelpers::get` with dot notation). Missing
  path → `defaultValue` (else `undefined`).
- `object<T = unknown>(): T` — alias of whole-body `json()` (TS has no stdClass
  vs array split; kept for SaloonPHP parity / readability).
- `header(name: string): string | undefined` — single header, case-insensitive.
- `headers(): ArrayStore<string>` — the (case-folded) header store.

### 2. Status predicates as methods on the response (return-based, no throwing)

Mirror SaloonPHP's `Response` helpers exactly:

- `ok()` — `status === 200`
- `successful()` — `200 ≤ status < 300`
- `redirect()` — `300 ≤ status < 400`
- `clientError()` — `400 ≤ status < 500`
- `serverError()` — `status ≥ 500`
- `failed()` — `clientError() || serverError()` (i.e. `status ≥ 400`). (SaloonPHP
  also consults connector/request custom failure detectors first; that hook is
  deferred to Slice 4, which owns connector/request behavior taps. The default
  `status ≥ 400` matches SaloonPHP's fallback when no detector is set.)
- `onError(cb: (response) => void): Response` — calls `cb(this)` when `failed()`,
  returns `this` for chaining.

### 3. Obtain the failure as a value (the headline of this slice)

- `toResult(): Result<Response, RequestError>` — `ok(response)` when not failed;
  `err(createRequestError(response))` when `failed()`. This is the canonical
  return-based accessor: callers `if (isErr(res.toResult())) …` or destructure.

No `throw()` method, no `toException()`, no `alwaysThrowOnErrors`. The maintainer's
stated invariant — "the only thrown error is the network error" — is kept: the
core never throws a `RequestError`. Callers who *want* throwing semantics already
have it for transport via `await`; for HTTP failures they opt in trivially
(`const { value } = unwrap(res.toResult())` style) in their own code.

### 4. `RequestError` — data in the `Err` channel, not a throwable the core uses

`RequestError extends SaloonError` (it *is* an `Error` so it carries a stack and
can be thrown by a *consumer* if they choose), but **the core only ever returns it
inside `Result.err`** — `send`/the sender never throw it.

To avoid the sprawling class tree of the old design while keeping idiomatic
predicates, `RequestError` is a **single class** carrying:

- `status: number`
- `statusName: RequestErrorKind` — a discriminant (`'unauthorized'`,
  `'notFound'`, `'serverError'`, `'clientError'`, `'requestError'`, …) so
  per-status predicates are O(1) and don't need a subclass each.
- accessors `getResponse()`, `getStatus()`, `getPendingRequest()`.
- Default message (PHP parity):
  `` `${statusText} (${status}) Response: ${bodyExcerpt}` `` with the body
  truncated to `maxBodyLength = 2000`.

`createRequestError(response): RequestError` ports `RequestExceptionHelper.php`:
maps 401/402/403/404/405/408/422/429/500/503/504 → their `statusName`; else
`serverError()` → `'serverError'`, `clientError()` → `'clientError'`, otherwise
`'requestError'`.

### 5. Predicates (`src/errors/predicates.ts`, extending Slice 1's)

Pure functions over the `statusName` discriminant (with `instanceof RequestError`
guarding first): `isRequestError`, `isClientError`, `isServerError`, and the
per-status `isUnauthorizedError`, `isPaymentRequiredError`, `isForbiddenError`,
`isNotFoundError`, `isMethodNotAllowedError`, `isRequestTimeoutError`,
`isUnprocessableEntityError`, `isTooManyRequestsError`, `isInternalServerError`,
`isServiceUnavailableError`, `isGatewayTimeoutError`. `isClientError` is true for
any 4xx (including the named ones); `isServerError` for any 5xx; `isRequestError`
for the whole family. (`isSaloonError`/`isFatalRequestError` already exist.)

### 6. `json()` / parse failures stay ergonomic (documented choice)

`json()` does **not** return a `Result`. A malformed-JSON body throws the plain
`SyntaxError` that `JSON.parse` raises — *not* a `SaloonError`. This keeps the
public reading surface ergonomic (`res.json<T>()` returns `T`, no unwrapping) and
preserves the invariant precisely: **no `SaloonError` is thrown by the core.** A
`SyntaxError` from bad JSON is an ordinary programming/runtime error, distinct from
the library's error model, and is what a JS dev expects from a `.json()` call.
(DTO parsing — `dto()` — arrives in Slice 7 and will make the same ergonomic
choice.)

## Files

- `src/result.ts` — already present (Slice's foundation). Add a small `unwrap`
  helper? No — keep `result.ts` minimal (`ok/err/isOk/isErr`); the slice needs no
  more.
- `src/errors/RequestError.ts` — new. The single `RequestError` class + the
  `RequestErrorKind` discriminant + `createRequestError` factory + the
  status→kind map. (`createRequestError` lives here, co-located with the class it
  builds, rather than a separate `createRequestError.ts`.)
- `src/errors/predicates.ts` — extend with the `RequestError` predicates.
- `src/errors/index.ts` — export `RequestError`, `createRequestError`,
  `RequestErrorKind`, and the new predicates.
- `src/contracts/Response.ts` — extend the `Response` interface with the new
  reading + status + `toResult`/`onError` members.
- `src/http/response.ts` — implement them in the factory.
- `src/index.ts` — re-export the new public surface.

## Tests (`tests/errors/`, `tests/http/`)

- `tests/errors/requestError.test.ts`: `createRequestError` status→kind mapping
  (404 → `notFound`, 418 → `clientError`, 500 → `internalServerError`, 599 →
  `serverError`, 302 → `requestError`); default message format; body truncation at
  2000; `instanceof SaloonError`/`Error`.
- `tests/errors/predicates.test.ts`: each predicate narrows correctly; false for
  unrelated errors / non-errors; `isClientError`/`isServerError`/`isRequestError`
  family relationships.
- `tests/http/response.test.ts` (live `testServer`): read success body; `json`
  dot-path + default; `object()`; `header()`; every status-class predicate at its
  boundaries via `/status/:code`; `onError` fires only on failure; **404 →
  `failed()` true, `toResult()` is `Err` carrying a `NotFoundError`-kind
  `RequestError`, and nothing throws**; a 2xx → `toResult()` is `Ok(response)`.

## Done criteria

- `Response` reading surface complete; 4xx/5xx resolve without throwing.
- `toResult()` returns the failure as a value; `RequestError` + predicates exported.
- Core throws **only** `FatalRequestError` (grep-verify: no `throw new RequestError`
  anywhere in `src/`).
- `pnpm test:everything` + `pnpm build` green.

## Reference

- `../saloon/src/Http/Response.php` (status helpers, `json($key)`, `onError`)
- `../saloon/src/Helpers/RequestExceptionHelper.php` (status→class map)
- `../saloon/src/Exceptions/Request/RequestException.php` (message format, 2000 cap)

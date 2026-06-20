# Slice 5 — Resilience: retries, delay & pooling

> **API style:** functional, no classes — see `api-style.md`. Retry settings are
> **config fields**; the retry loop lives in the free `send()`; `pool` is a **free
> function** returning a controller object (factory, not class).

## Goal
Resilience + concurrency: the full retry loop in `send()`, the delay middleware
(finally using `integerStore`), and a dependency-free concurrency pool.

## Example (consumer API)
```ts
import { defineConnector, defineRequest, send, pool, withRetry, Method, isServerError } from 'saloon-js';

const api = defineConnector({
  baseUrl: 'https://api.example.com',
  tries: 3,                       // retry config as plain fields
  retryInterval: 200,             // ms
  useExponentialBackoff: true,    // 200ms, 400ms, 800ms…
  handleRetry: (e) => isServerError(e),   // only retry 5xx
});

const getUser = (u: string) => defineRequest({ method: Method.GET, endpoint: `/users/${u}` });

// Per-request delay + per-call retry override.
const slow = defineRequest({ method: Method.GET, endpoint: '/slow', delay: 1000 });
await send(api, withRetry(getUser('ada'), { tries: 5, throwOnMaxTries: false }));

// Bounded-concurrency pool — a free function returning a controller.
await pool(api, {
  requests: ['ada', 'grace', 'edsger'].map((u) => getUser(u)),  // pulled lazily
  concurrency: 5,
  onResponse: (res, key) => console.log(key, res.status()),
  onError: (err, key) => console.error(key, err),
}).send();
```

## Files

### `src/repositories/integerStore.ts`
Port of `IntegerStore.php`, as a factory. Holds `number | null`:
- `createIntegerStore(value?: number | null): IntegerStore`
- `set(value)`, `get()`, `isEmpty()` (null/0 → empty per PHP `empty()`),
  `isNotEmpty()`; export the `IntegerStore` interface.
- Used as `pending.delay` (added to the PendingRequest state now).

### Retry config (fields on `ConnectorConfig` + `RequestConfig`)
Port of `HasTries.php`. Optional on both (request overrides connector): `tries?`,
`retryInterval?` (ms), `useExponentialBackoff?`, `throwOnMaxTries?`, plus hook
`handleRetry?: (error) => boolean | Promise<boolean>` (default true). Normalized
values expose these for `send`. Optional transformer `withRetry(target, patch)`.

### `src/http/send.ts` — full retry loop
Replace the simple `send` with the retry loop (port of `SendsRequests::send`),
still a free function over `(connector, request, options)`:
```ts
const maxTries = request.tries ?? connector.tries ?? 1;
for (let attempt = 1; attempt <= maxTries; attempt++) {
  if (attempt > 1 && interval) await sleep(backoff ? interval * 2**(attempt-2) * 1000 : interval * 1000);
  try {
    const pending = await createPendingRequest(connector, request, options);
    let response = await connector.sender.send(pending);
    response = await pending.executeResponsePipeline(response);
    if (maxTries > 1) response.throw();   // force retry path on failed status
    return response;
  } catch (e) {
    if (!(isFatalRequestError(e) || isRequestError(e))) throw e;
    const resp = isRequestError(e) ? e.getResponse() : undefined;
    if (isFatalRequestError(e)) await e.pendingRequest.executeFatalPipeline(e);
    const last = attempt === maxTries;
    const allow = !last && (await (request.handleRetry ?? (() => true))(e)) && (await (connector.handleRetry ?? (() => true))(e));
    if (last || !allow) { if (resp && !(request.throwOnMaxTries ?? connector.throwOnMaxTries ?? true)) return resp; throw e; }
  }
}
```
- `src/helpers/sleep.ts` — `sleep(ms)`.
- Discrimination via the Slice-3 predicates (`isFatalRequestError`/`isRequestError`),
  not `instanceof`.
- The fake-response branch (`pending.hasFakeResponse()` → `createFakeResponse`) is
  **not** added here — Slice 6 introduces it together with the mock client that
  makes it reachable.

### Delay machinery (added here — first used now)
- `delay?: number` (ms) config field on `ConnectorConfig` + `RequestConfig` (request
  overrides connector); exposed on the normalized values.
- `src/http/pending/mergeDelay.ts` tap — set `pending.delay` from connector, override
  with request if set. Add it to the tap list before `authenticate`.
- `src/http/middleware/delay.ts` — register it last in the request pipeline: if
  `pending.delay` not empty, `await sleep(pending.delay.get())`.
- `pending.delay` (an `integerStore`) is added to the PendingRequest state here too.

### `src/http/pool.ts`
Port of `Pool.php` semantics with a bounded worker loop (no Guzzle EachPromise).
A **free function**, not a method/class:
- `pool(connector, { requests, concurrency = 5, onResponse?, onError? }): Pool`
- `requests`: `Iterable | AsyncIterable | (connector) => Iterable` — pulled lazily
  so middleware runs at send time.
- `Pool.send(): Promise<void>` — N workers pull from a shared iterator, each runs
  `send(connector, req)`, dispatching `onResponse(res, key)` / `onError(reason, key)`.
  `concurrency` may be a number or `() => number`.
- builder methods on the returned object: `withResponseHandler`,
  `withErrorHandler`, `setConcurrency` (or pass everything in the options bag).

## Tests (`tests/`)
- `tests/repositories/integerStore.test.ts`: null default empty; set/get; `0`
  treated as empty (PHP `empty()`); positive value not empty.
- `tests/retries.test.ts` (live server): the `/flaky?key=&fails=N` route fails N
  times then succeeds → succeeds within `tries`; exponential backoff timing (vitest
  fake timers); `throwOnMaxTries=false` returns last failed response; `handleRetry`
  → false stops retrying; `FatalRequestError` triggers the fatal pipeline.
- `tests/delay.test.ts`: request with delay waits ~that long (fake timers).
- `tests/pool.test.ts`: M requests against `/concurrent`, concurrency C never
  exceeded — assert `server.maxInFlight <= C`; onResponse/onError fired per item;
  lazy generator requests built at send time.

## Done criteria
- Retry/backoff/throwOnMaxTries/handleRetry covered + green.
- Delay middleware awaited.
- Pool respects the concurrency bound (max-in-flight counter) and handles
  success/error per item.
- typecheck + lint + build clean.

## Reference
- `../saloon/src/Traits/Connector/SendsRequests.php`, `../saloon/src/Traits/RequestProperties/HasTries.php`
- `../saloon/src/Http/Middleware/DelayMiddleware.php`
- `../saloon/src/Http/Pool.php`
- `../saloon/src/Repositories/IntegerStore.php`

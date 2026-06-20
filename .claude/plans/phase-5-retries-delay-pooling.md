# Phase 5 — Retries, delay, pooling

> **API style:** functional, no classes — see `api-style.md`. Retry settings are
> **config fields** on `defineConnector`/`defineRequest`; the retry loop lives in
> the free `send()`; `pool` is a **free function** `pool(connector, opts)`.

## Goal
Resilience + concurrency. Full retry loop in `send()`, the delay middleware, and a dependency-free concurrency pool.

## Files

### Retry config (fields on `ConnectorConfig` + `RequestConfig`)
Port of `../saloon/src/Traits/RequestProperties/HasTries.php`. Optional fields on both configs: `tries?`, `retryInterval?` (ms), `useExponentialBackoff?`, `throwOnMaxTries?`. Plus hook `handleRetry?: (error) => boolean | Promise<boolean>` (default true). Request values override connector values. The normalized `Connector`/`Request` values expose these for `send` to read; `withRetry(target, patch)` may be added as a transformer for ergonomics.

### `src/http/send.ts` — full retry loop
Replace the Phase 3 simple `send` with the async retry loop (port of `SendsRequests::send`), still a free function over `(connector, request, options)`:
```ts
const maxTries = request.tries ?? connector.tries ?? 1;
for (let attempt = 1; attempt <= maxTries; attempt++) {
  if (attempt > 1 && interval) await sleep(backoff ? interval * 2**(attempt-2) * 1000 : interval * 1000);
  try {
    const pending = await createPendingRequest(connector, request, options);
    let response = pending.hasFakeResponse() ? await createFakeResponse(pending) : await connector.sender.send(pending);
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
- `sleep(ms)` helper in `src/helpers/sleep.ts`.
- Discrimination uses the Phase 2 predicates (`isFatalRequestError`/`isRequestError`), not `instanceof`.

### `src/http/middleware/delay.ts`
Registered last in the request pipeline (Phase 3 left it a no-op). Now: if `pending.delay` not empty, `await sleep(pending.delay.get())`.

### `src/http/pool.ts`
Port of `../saloon/src/Http/Pool.php` semantics with a bounded worker loop (no Guzzle EachPromise). A **free function**, not a method or class:
- `pool(connector, { requests, concurrency = 5, onResponse?, onError? }): Pool` — returns a `Pool` controller object (factory, not class).
- `requests`: `Iterable<Request> | AsyncIterable<Request> | (connector) => Iterable<Request>` — pull lazily so middleware runs at send time.
- `Pool.send(): Promise<void>` — N workers pull from a shared iterator, each runs `send(connector, req)`, dispatching `onResponse(res, key)` / `onError(reason, key)`. `concurrency` may be a number or `() => number`.
- builder methods on the returned object: `withResponseHandler`, `withErrorHandler`, `setConcurrency` (or pass everything in the options bag).

## Tests (`tests/`)
- `retries.test.ts`: local route that fails N times then succeeds → succeeds within `tries`; exponential backoff timing (fake timers via vitest); `throwOnMaxTries=false` returns last failed response instead of throwing; `handleRetry` returning false stops retrying; a `FatalRequestError` triggers the fatal pipeline.
- `delay.test.ts`: request with delay waits ~that long (fake timers).
- `pool.test.ts`: pool of M requests with concurrency C never exceeds C in flight (instrument the test server); onResponse/onError fired per item; lazy generator requests built at send time.

## Done criteria
- Retry/backoff/throwOnMaxTries/handleRetry all covered + green.
- Delay middleware awaited.
- Pool respects concurrency bound (verified by max-in-flight counter) and handles both success/error per item.

## Reference
- `../saloon/src/Traits/Connector/SendsRequests.php`, `../saloon/src/Traits/RequestProperties/HasTries.php`
- `../saloon/src/Http/Middleware/DelayMiddleware.php`
- `../saloon/src/Http/Pool.php`

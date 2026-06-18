# Phase 5 — Retries, delay, pooling

## Goal
Resilience + concurrency. Full retry loop in `send()`, the delay middleware, and a dependency-free concurrency pool.

## Files

### Retry config (mix into Connector + Request)
Port of `saloon/src/Traits/RequestProperties/HasTries.php`. Optional fields on both: `tries?`, `retryInterval?` (ms), `useExponentialBackoff?`, `throwOnMaxTries?`. Plus hook `handleRetry(exception): boolean | Promise<boolean>` (default true). Request values override connector values.

### `src/http/Connector.ts` — full `send()` retry loop
Replace Phase 3 simple send with the async retry loop (port of `SendsRequests::send`):
```ts
const maxTries = request.tries ?? this.tries ?? 1;
for (let attempt = 1; attempt <= maxTries; attempt++) {
  if (attempt > 1 && interval) await sleep(backoff ? interval * 2**(attempt-2) * 1000 : interval * 1000);
  try {
    const pending = await this.createPendingRequest(request, mockClient);
    let response = pending.hasFakeResponse() ? await this.createFakeResponse(pending) : await this.sender.send(pending);
    response = await pending.executeResponsePipeline(response);
    if (maxTries > 1) response.throw();   // force retry path on failed status
    return response;
  } catch (e) {
    if (!(e instanceof FatalRequestException || e instanceof RequestException)) throw e;
    const resp = e instanceof RequestException ? e.getResponse() : undefined;
    if (e instanceof FatalRequestException) await e.pendingRequest.executeFatalPipeline(e);
    const last = attempt === maxTries;
    const allow = !last && (await request.handleRetry(e)) && (await this.handleRetry(e));
    if (last || !allow) { if (resp && !(request.throwOnMaxTries ?? this.throwOnMaxTries ?? true)) return resp; throw e; }
  }
}
```
- `sleep(ms)` helper in `src/helpers/sleep.ts`.

### `src/http/middleware/delay.ts`
Registered last in the request pipeline (Phase 3 left it a no-op). Now: if `pending.delay` not empty, `await sleep(pending.delay.get())`.

### `src/http/Pool.ts`
Port of `saloon/src/Http/Pool.php` semantics with a bounded worker loop (no Guzzle EachPromise).
- `pool({ requests, concurrency=5, onResponse?, onError? })` on Connector returns a `Pool`.
- `requests`: `Iterable<Request> | AsyncIterable<Request> | (connector) => Iterable<Request>` — pull lazily so middleware runs at send time.
- `Pool.send(): Promise<void>` — N workers pull from a shared iterator, each runs `connector.send(req)`, dispatching `onResponse(res, key)` / `onError(reason, key)`. `concurrency` may be a number or `() => number`.
- builders: `withResponseHandler`, `withExceptionHandler`, `setConcurrency`.

## Tests (`tests/`)
- `retries.test.ts`: local route that fails N times then succeeds → succeeds within `tries`; exponential backoff timing (fake timers via vitest); `throwOnMaxTries=false` returns last failed response instead of throwing; `handleRetry` returning false stops retrying; FatalRequestException triggers fatal pipeline.
- `delay.test.ts`: request with delay waits ~that long (fake timers).
- `pool.test.ts`: pool of M requests with concurrency C never exceeds C in flight (instrument the test server); onResponse/onError fired per item; lazy generator requests built at send time.

## Done criteria
- Retry/backoff/throwOnMaxTries/handleRetry all covered + green.
- Delay middleware awaited.
- Pool respects concurrency bound (verified by max-in-flight counter) and handles both success/error per item.

## Reference
- `saloon/src/Traits/Connector/SendsRequests.php`, `saloon/src/Traits/RequestProperties/HasTries.php`
- `saloon/src/Http/Middleware/DelayMiddleware.php`
- `saloon/src/Http/Pool.php`

# Retries, delay & pooling

Resilience and concurrency knobs: retry failed sends, delay before sending, and
run many requests with a bounded number in flight.

## Retries

Set the retry knobs as plain config fields on a connector (defaults for every
request) or a request (overrides the connector). `send()` runs the retry loop.

```ts
import { defineConnector, defineRequest, send, Method, isServerError } from 'saloon-js';

const api = defineConnector({
  baseUrl: 'https://api.example.com',
  tries: 3,                     // up to 3 attempts (1 = no retries, the default)
  retryInterval: 200,           // wait 200ms between attempts (milliseconds)
  useExponentialBackoff: true,  // 200ms, 400ms, 800ms… (interval · 2^(n-1))
  throwOnMaxTries: true,        // throw when retries run out (the default)
  handleRetry: (error) => isServerError(error), // only retry 5xx
});

const getUser = (id: string) => defineRequest({ method: Method.GET, endpoint: `/users/${id}` });
await send(api, getUser('ada'));
```

What counts as a failure worth retrying:

- A `FatalRequestError` (transport failure — DNS, refused connection, timeout).
- A failed HTTP status (`status >= 400`). When `tries > 1`, a failed status is
  surfaced as a `RequestError` to drive the retry loop, even though a single
  send normally [returns it as a value](error-handling.md).

Both `handleRetry` gates (request **and** connector) must return `true` for a
retry to happen; either returning `false` stops immediately. The gate may be
async and receives the `FatalRequestError` / `RequestError`.

When attempts are exhausted:

- `throwOnMaxTries: true` (default) — throw the last error.
- `throwOnMaxTries: false` — return the last failed `Response` instead.

### Per-call override with `withRetry`

```ts
import { withRetry } from 'saloon-js';

// Give one request more attempts and don't throw at the end.
await send(api, withRetry(getUser('ada'), { tries: 5, throwOnMaxTries: false }));
```

`withRetry(target, patch)` returns a new frozen connector/request with the retry
fields patched — like the other [`withX` transformers](requests.md).

## Delay

`delay` (milliseconds) waits before each send. Set it on a connector or request
(request wins).

```ts
const slow = defineRequest({ method: Method.GET, endpoint: '/slow', delay: 1000 });
await send(api, slow); // waits 1000ms, then sends
```

Internally the delay is held in an `IntegerStore` on the pending request
(`pending.delay`) and awaited by a request-pipeline middleware. `0` and unset
both mean "no delay" (PHP `empty()` semantics, the same quirk used for bodies).
The delay is **skipped for mocked responses** (the mock path never hits the
network), so tests against a [mock client](testing.md) stay instant even when a
`delay` is configured.

## Pooling

`pool` runs many requests with a bounded number in flight. It is a free function
returning a controller you configure and then `send()`.

```ts
import { pool, defineConnector, defineRequest, Method } from 'saloon-js';

const getUser = (u: string) => defineRequest({ method: Method.GET, endpoint: `/users/${u}` });

await pool(api, {
  requests: ['ada', 'grace', 'edsger'].map(getUser),
  concurrency: 5, // max simultaneous requests (default 5; may be a () => number)
  onResponse: (response, key) => console.log(key, response.status()),
  onError: (reason, key) => console.error(key, reason),
}).send();
```

- `requests` is an iterable, async iterable, or a `(connector) => iterable`
  function — **pulled lazily** at `send()` time, so generators and their
  middleware only run as workers consume them.
- `key` is each request's 0-based pull order.
- `onError` fires when a send throws — i.e. a transport failure, or any failed
  status when retries/`alwaysThrowOnErrors` cause `send()` to throw. A failed
  status that `send()` returns as a value reaches `onResponse`.
- A throwing handler (`onResponse`, `onError`) or a throwing request source stops
  the pool: in-flight sends finish, no further requests are pulled, and `send()`
  rejects with that error. A handler error is never re-routed to `onError`.

The controller also exposes builder methods (each returns the controller):

```ts
await pool(api, { requests: ['ada', 'grace'].map(getUser) })
  .withResponseHandler((response, key) => console.log(key, response.status()))
  .withErrorHandler((reason, key) => console.error(key, reason))
  .setConcurrency(3)
  .send();
```

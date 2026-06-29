# saloon-js

Build beautiful API integrations and SDKs. A TypeScript port of
[SaloonPHP](https://github.com/saloonphp/saloon) with a **functional, class-free
API**: you describe a *connector* (one per API) and *requests* (one per
endpoint) as plain config, then call `send()`.

```ts
import { defineConnector, defineRequest, tokenAuth, send, isOk, Method } from 'saloon-js';

const gitHub = (token: string) =>
  defineConnector({
    baseUrl: 'https://api.github.com',
    headers: { Accept: 'application/vnd.github+json' },
    auth: tokenAuth(token),
  });

const listRepos = (user: string) =>
  defineRequest({ method: Method.GET, endpoint: `/users/${user}/repos` });

const response = await send(gitHub(process.env.GITHUB_TOKEN!), listRepos('saloonphp'));

if (response.successful()) {
  const body = response.json(); // Result<unknown, SyntaxError>
  if (isOk(body)) console.log(body.value);
}
```

## Install

```bash
pnpm add saloon-js   # npm i / yarn add also work
```

Requires Node ≥ 22. ESM-first with a CJS build; ships its own types.

## Guide

- [Getting started](getting-started.md) — your first connector, request, and send
- [Connectors](connectors.md) — base URL, default headers/query, auth, plugins
- [Requests](requests.md) — methods, dynamic endpoints, DTOs, per-call tweaks
- [Responses](responses.md) — reading status, JSON, headers; success predicates
- [Authentication](authentication.md) — token, basic, header, query, multi
- [OAuth2](oauth2.md) — authorization code & client credentials grants, token store
- [Request body](request-body.md) — JSON, form, multipart, string, stream
- [Plugins](plugins.md) — `acceptsJson`, `hasTimeout`, `alwaysThrowOnErrors`
- [Retries, delay & pooling](resilience.md) — `tries`/`withRetry`, `delay`, `pool`
- [Error handling](error-handling.md) — return-based errors vs. throwing
- [Testing](testing.md) — mock clients, fake responses, recorded fixtures

## Advanced / low-level exports

Most users only need the surface above. The library also exports lower-level
primitives for advanced use and for building your own pieces:

- `fetchSender` / `createFetchSender` — the default sender; inject a custom
  `fetch`. See [Connectors → Custom sender](connectors.md#custom-sender).
- `ok` / `err` / `isOk` / `isErr` and the `Result` type — the `Result` primitive
  returned by `response.json()` / `response.toResult()`.
- `createArrayStore` / `ArrayStore` — the case-folding key/value store backing
  headers, query, and config (you meet it as `pending.headers`,
  `response.headers()`, etc.).
- `createIntegerStore` / `IntegerStore` — the nullable-integer store backing
  `pending.delay`. See [Retries, delay & pooling](resilience.md#delay).
- `createMiddlewarePipeline` — the request/response/fatal pipeline used by
  [`withMiddleware`](plugins.md#ad-hoc-middleware).
- `RequestError` / `SaloonError` / `FatalRequestError` classes and
  `createRequestError` — the throwable error types. See
  [Error handling](error-handling.md).

Types for every config object are exported too (`ConnectorConfig`,
`RequestConfig`, `Authenticator`, `Plugin`, `Sender`, `MockClient`, …).

## Why functional?

There is no `class extends Connector`. Connectors and requests are values
produced by `defineConnector` / `defineRequest`; behavior is invoked with free
functions (`send`, the `withX` transformers, the auth/body factories). Per-call
overrides *compose* instead of subclassing. Errors are the one carve-out — they
stay `class extends Error` so they remain throwable.

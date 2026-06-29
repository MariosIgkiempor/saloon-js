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
- [Request body](request-body.md) — JSON, form, multipart, string, stream
- [Plugins](plugins.md) — `acceptsJson`, `hasTimeout`, `alwaysThrowOnErrors`
- [Error handling](error-handling.md) — return-based errors vs. throwing
- [Testing](testing.md) — mock clients, fake responses, recorded fixtures

## Why functional?

There is no `class extends Connector`. Connectors and requests are values
produced by `defineConnector` / `defineRequest`; behavior is invoked with free
functions (`send`, the `withX` transformers, the auth/body factories). Per-call
overrides *compose* instead of subclassing. Errors are the one carve-out — they
stay `class extends Error` so they remain throwable.

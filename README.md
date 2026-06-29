# saloon-js

Build beautiful API integrations and SDKs. A TypeScript port of
[SaloonPHP](https://github.com/saloonphp/saloon): you describe a *connector* (one
per API) and *requests* (one per endpoint) as plain config, then call `send()`.

```bash
pnpm add saloon-js   # npm i / yarn add also work
```

Requires Node ≥ 22. ESM-first with a CJS build; ships its own types. The barrel
is side-effect free, so importing `send` never pulls in the OAuth2 or faking
code you don't use.

## Quickstart

```ts
import { defineConnector, defineRequest, send, tokenAuth, acceptsJson, Method, isErr, isNotFoundError } from 'saloon-js';

interface Repo { fullName: string; stars: number }

const gitHub = (token: string) =>
  defineConnector({
    baseUrl: 'https://api.github.com',
    auth: tokenAuth(token),
    plugins: [acceptsJson()],
  });

const getRepo = (owner: string, repo: string) =>
  defineRequest<Repo>({
    method: Method.GET,
    endpoint: `/repos/${owner}/${repo}`,
    dto: (r) => ({ fullName: r.json<string>('full_name'), stars: r.json<number>('stargazers_count') }),
  });

const res = await send(gitHub(process.env.GITHUB_TOKEN ?? ''), getRepo('saloonphp', 'saloon'));

const result = res.toResult();
if (isErr(result)) {
  if (isNotFoundError(result.error)) console.error('no such repo');
} else {
  const repo = res.dto();
  console.log(`★ ${repo.stars}  ${repo.fullName}`);
}
```

## Connectors and requests

A **connector** holds everything shared across an API: base URL, default
headers/query, auth, plugins, retry policy. A **request** describes one endpoint.
Both are plain values produced by factory functions — wrap them in your own
functions to take parameters.

```ts
const api = defineConnector({
  baseUrl: 'https://api.example.com',
  headers: { Accept: 'application/json' },
  query: { api_version: '2024-01' },
});

const getUser = (id: string) =>
  defineRequest({ method: Method.GET, endpoint: `/users/${id}` });

const res = await send(api, getUser('42'));
```

## Reading responses

4xx/5xx are **not** thrown — a completed round-trip is a success at the
transport level. Read status, body, headers, and JSON directly:

```ts
res.status();           // 200
res.successful();       // 200–299
res.failed();           // status ≥ 400
res.header('etag');     // single header (case-insensitive)
res.body();             // raw string body

res.json();             // Result<unknown, SyntaxError> — never throws on bad JSON
res.json<string>('user.name', 'anon');   // dot-path read with a fallback
```

`json()` with no key returns a [`Result`](#error-handling) you unwrap explicitly;
`json(key)` reads a single dot-path value and returns it directly.

## Precedence and per-call tweaks

Request config is merged over connector config (request wins). For one-off
overrides, the `withX` transformers return a **new** value rather than mutating
the original:

```ts
import { withHeaders, withQuery, withConfig, withBody, withAuth, withRetry, withMiddleware } from 'saloon-js';

await send(api, withQuery(getUser('42'), { include: 'orgs' }));
await send(api, withHeaders(getUser('42'), { 'If-None-Match': etag }));
```

## Request body

Pick a body repository to match the content type. The body sets its own
`Content-Type` unless you override it:

```ts
import { jsonBody, formBody, multipartBody, stringBody, streamBody } from 'saloon-js';

defineRequest({ method: Method.POST, endpoint: '/users', body: jsonBody({ name: 'Ada' }) });
defineRequest({ method: Method.POST, endpoint: '/login', body: formBody({ user: 'ada', pass: 'x' }) });
defineRequest({ method: Method.POST, endpoint: '/upload', body: multipartBody([
  { name: 'file', value: blob, filename: 'avatar.png' },
]) });
defineRequest({ method: Method.POST, endpoint: '/raw', body: stringBody('hello', 'text/plain') });
```

## Authentication

Authenticators are factories; set one on the connector (or per request via
`withAuth`):

```ts
import { tokenAuth, basicAuth, headerAuth, queryAuth, multiAuth } from 'saloon-js';

tokenAuth('abc');                         // Authorization: Bearer abc
basicAuth('user', 'pass');                // Authorization: Basic …
headerAuth('abc', 'X-API-Key');           // X-API-Key: abc
queryAuth('api_key', 'abc');              // ?api_key=abc
multiAuth(tokenAuth('abc'), queryAuth('v', '2'));  // apply several
```

## Plugins

Plugins are factories you list in `plugins`. They boot before each send and can
add headers, config, or response middleware:

```ts
import { acceptsJson, hasTimeout, alwaysThrowOnErrors } from 'saloon-js';

defineConnector({
  baseUrl: 'https://api.example.com',
  plugins: [acceptsJson(), hasTimeout({ request: 5_000 }), alwaysThrowOnErrors()],
});
```

`alwaysThrowOnErrors()` opts a connector into throwing on 4xx/5xx (calling
`response.throw()` for you in the response pipeline).

## Middleware

For ad-hoc behavior, register request/response/fatal middleware on the pipeline:

```ts
import { withMiddleware } from 'saloon-js';

const logged = withMiddleware(getUser('42'), (pipeline) => {
  pipeline.onRequest((pending) => { console.log(pending.url); });
  pipeline.onResponse((response) => { console.log(response.status()); return response; });
});
```

## Retries and delay

Set retry knobs on the connector or request (request wins), or per call with
`withRetry`:

```ts
defineConnector({
  baseUrl: 'https://api.example.com',
  tries: 3,
  retryInterval: 200,
  useExponentialBackoff: true,
  throwOnMaxTries: false,            // return the last failed response instead of throwing
  handleRetry: (error) => true,      // gate each retry on the failure
});

await send(api, withRetry(getUser('42'), { tries: 5 }));
```

A connector- or request-level `delay` (ms) waits before each send.

## Pooling

`pool` runs many requests with bounded concurrency:

```ts
import { pool } from 'saloon-js';

await pool(api, {
  requests: ['1', '2', '3'].map(getUser),
  concurrency: 5,
  onResponse: (response, key) => console.log(key, response.status()),
  onError: (reason, key) => console.error(key, reason),
}).send();
```

`requests` may be an array, an iterable, an async iterable, or a function
returning one — handy for streaming a large work list.

## DTOs

A request's `dto` hook maps a response into your domain type; the generic on
`defineRequest<T>` types `response.dto()` as `T`. A connector-level `dto` is the
fallback when a request defines none.

```ts
const getUser = (id: string) =>
  defineRequest<User>({
    method: Method.GET,
    endpoint: `/users/${id}`,
    dto: (r) => ({ id: r.json<string>('id'), email: r.json<string>('email') }),
  });

const user = (await send(api, getUser('1'))).dto();     // User
(await send(api, getUser('1'))).dtoOrFail();            // throws first if failed()
```

## Error handling

Errors are **values by default**. `toResult()` gives you the failure without a
`try/catch`; predicates narrow it:

```ts
import { isErr, isNotFoundError, isServerError, isRequestError } from 'saloon-js';

const result = res.toResult();           // Result<Response, RequestError>
if (isErr(result)) {
  if (isNotFoundError(result.error)) { /* 404 */ }
  if (isServerError(result.error))   { /* 5xx */ }
}
```

When you prefer exceptions, opt in: `response.throw()`, `dtoOrFail()`, or the
`alwaysThrowOnErrors()` plugin. The thrown `RequestError`/`SaloonError`/
`FatalRequestError` classes are exported for `instanceof`, but the predicate
helpers (`isNotFoundError`, `isUnauthorizedError`, `isTooManyRequestsError`, …)
are the primary surface.

## Testing

`createMockClient` intercepts sends — no network, full assertions. Keys match by
request name, connector name, or URL pattern; bare arrays are consumed in order:

```ts
import { createMockClient, mockResponse, fixture } from 'saloon-js';

const mock = createMockClient([
  mockResponse({ id: '1', name: 'Ada' }),
  mockResponse({ message: 'Not Found' }, 404),
]);

const res = await send(api, getUser('1'), { mockClient: mock });
mock.assertSentCount(1);
```

`mockResponse(body, status?, headers?)` builds a fake response; `.throw()` makes
the send reject. `fixture('name')` records a real response to disk on first run
and replays it after. Register a mock globally with `setGlobalMockClient`.

## OAuth2

Both grants are supported. Provide an `oauth` config and a `tokens` store; `send`
loads the token, refreshes it when expired, and persists the new one — no
stateful connector instance to thread:

```ts
import { defineConnector, authorizationUrl, exchangeCode, serializeAuth, deserializeAuth, send } from 'saloon-js';

const spotify = defineConnector({
  baseUrl: 'https://api.spotify.com/v1',
  oauth: {
    clientId: '…',
    clientSecret: '…',
    redirectUri: 'https://example.com/callback',
    authorizeEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
  },
  tokens: {
    load: () => { const raw = db.read(); return raw ? deserializeAuth(raw) : null; },
    save: (auth) => db.write(serializeAuth(auth)),
  },
});

const { url, state } = authorizationUrl(spotify, { scopes: ['user-read-email'] });
// …redirect the user to `url`, then on the callback:
const auth = await exchangeCode(spotify, codeFromCallback);
await spotify.tokens?.save(auth);

// Later requests auto-refresh — no `withAuth` needed:
const me = await send(spotify, getCurrentUser());
```

The client-credentials grant (`clientCredentials(connector)`) and pure token
threading (`withAuth(request, accessTokenAuth({ accessToken }))`) are also
available.

## Divergences from SaloonPHP

- **No base classes to extend.** Connectors and requests are values from
  `defineConnector`/`defineRequest`, not subclasses of a `Connector`/`Request`.
- **Plugins are an explicit array**, not PHP traits.
- **Per-call overrides** use `withX` transformers instead of subclassing.
- **Async only** — everything returns a `Promise`; there is no sync/`sendAsync`
  split.
- **Buffered response bodies** — the body is read once and cached.
- **Errors are values by default**, named `*Error` (not `*Exception`), with
  predicate helpers; throwing is opt-in.
- **OAuth state is injected** via a `tokens: { load, save }` store rather than
  living on a stateful connector instance.

## Documentation

Full guide in [`docs/`](docs/index.md): connectors, requests, responses,
authentication, OAuth2, request body, plugins, resilience, error handling, and
testing.

## License

[MIT](LICENSE). A TypeScript port of [SaloonPHP](https://github.com/saloonphp/saloon)
by Sam Carré, also MIT.

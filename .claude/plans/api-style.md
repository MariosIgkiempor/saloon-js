# API style — functional, no classes (the cross-cutting decision)

> **Status:** decided. **Behavior/feature parity with SaloonPHP is unchanged** —
> only the *shape* of the public API changes (functional, not class-based). Every
> slice (see `slices.md`) references the vocabulary defined here.

## The decision

saloon-js exposes a **functional API**. Users never write `class … extends
Connector` or `class … extends Request`. Instead:

- A **connector** is a value produced by `defineConnector(config)`.
- A **request** is a value produced by `defineRequest(config)` (usually wrapped
  in your own factory function for parameters).
- Behavior is invoked by **free functions** — `send(connector, request)`,
  `pool(...)`, `authorizationUrl(...)` — not methods on a base class.
- Customization that PHP did via `protected default*()` overrides becomes
  **config fields** (a value, or a thunk when it needs to be lazy/dynamic).
- Per-call tweaks that PHP did via subclassing become **immutable
  transformers**: `withHeaders(request, patch)`, `withQuery`, `withAuth`, ….

```ts
const gitHub = (token: string) =>
  defineConnector({
    baseUrl: 'https://api.github.com',
    headers: { Accept: 'application/vnd.github+json' },
    auth: tokenAuth(token),
  });

const getRepo = (owner: string, repo: string) =>
  defineRequest<Repo>({
    method: Method.GET,
    endpoint: `/repos/${owner}/${repo}`,
    dto: (res) => res.json(),
  });

const res = await send(gitHub(token), getRepo('saloonphp', 'saloon'));
const repo = res.dto();
```

See `examples/github-api/functional.ts` for the worked reference, including the
OAuth2 token-store flow.

## How PHP/class concepts map

| SaloonPHP (class/trait) | saloon-js (functional) |
| --- | --- |
| `class C extends Connector` | `defineConnector(config)` → `Connector` value |
| `class R extends Request` | `defineRequest<TDto>(config)` → `Request<TDto>` value |
| `resolveBaseUrl()` | `config.baseUrl: string \| (c) => string` |
| `resolveEndpoint()` | `config.endpoint: string \| (r) => string` |
| `protected Method $method` | `config.method: Method` |
| `defaultHeaders/Query/Config()` | `config.headers/query/config: object \| thunk` |
| `defaultAuth()` | `config.auth: Authenticator \| thunk` |
| `defaultBody()` | `config.body: BodyRepository \| thunk` |
| `plugins(): array` | `config.plugins: Plugin[]` |
| `boot($pending)` | `config.boot: (pending) => void` |
| `handleRetry($e)` | `config.handleRetry: (e) => boolean` |
| `$connector->send($req)` | `send(connector, req, options?)` |
| `$connector->sendAsync()` | n/a — everything is already a `Promise` |
| subclass to override per call | `withHeaders/withQuery/withAuth/withBody(target, patch)` |
| `use AuthorizationCodeGrant` (trait) | `oauth` + `tokens` config + free OAuth functions |
| `Conditionable` (`->when()`) | plain `if` / compose; dropped |
| `Macroable` | dropped (no class to extend) |
| custom Response class (`HasCustomResponses`) | `config.responseFactory` hook |

## Internal machinery is functional too

The internal building blocks that SaloonPHP implements as classes become
**factory functions returning plain objects** (closures over private state — no
`class`, no inheritance, methods are object properties). Public method
ergonomics (`pending.headers.add(...)`, `response.json()`) are preserved.

| Was a class | Becomes |
| --- | --- |
| `ArrayStore` | `createArrayStore<T>(data?)` |
| `IntegerStore` | `createIntegerStore(value?)` |
| `MiddlewarePipeline` | `createMiddlewarePipeline()` |
| `PendingRequest` | `createPendingRequest(connector, request, opts)` (mutable object the taps mutate) |
| `Response` | `responseFromFetch(...)` / `createResponse(...)` |
| `FetchSender` | `fetchSender` (a `{ send }` object) / `createFetchSender(opts)` |
| `MockClient` | `createMockClient(mockData?)` (assert/record methods on the object) |
| `Fixture` | `fixture(name, opts?)` |
| body repos / authenticators / plugins | already factories (`jsonBody`, `tokenAuth`, `acceptsJson`, …) |

Contracts stay **interfaces/types** (`Sender`, `Authenticator`, `Plugin`,
`BodyRepository`, `FakeResponse`) — interfaces aren't classes and define the
shape every factory returns. The `connector`/`request` values are typed by
`Connector` / `Request<TDto>` interfaces (the normalized output of
`defineConnector`/`defineRequest`).

## The one carve-out: Error types stay `class … extends Error`

Errors are the single exception, and deliberately so:

- A real throwable **must** `extend Error` to carry a stack/`name`; there is no
  functional substitute that interops with `try/catch`, `cause`, and tooling.
- Users never *author* or *subclass* these — they only **catch** them — so they
  are not part of the authoring surface the decision is about.

To keep discrimination functional-friendly, the **primary** API is predicate
helpers; `instanceof` remains available for those who want it:

```ts
try { await send(c, r); }
catch (e) {
  if (isNotFoundError(e)) { /* 404 */ }
  else if (isServerError(e)) { /* 5xx */ }
  else if (isFatalRequestError(e)) { /* transport */ }
}
```

Predicates to provide: `isSaloonError`, `isRequestError`, `isFatalRequestError`,
`isClientError`, `isServerError`, and per-status `isNotFoundError`,
`isUnauthorizedError`, `isTooManyRequestsError`, … (mirror the status classes).
Errors are constructed by `createRequestError(response, cause?)` (was
`RequestExceptionHelper`); the class hierarchy is the implementation detail
behind the predicates.

## Immutability & state

- `defineConnector`/`defineRequest` return **frozen, reusable values**.
  `withX(target, patch)` returns a **new** value; it never mutates.
- `PendingRequest` is the one intentionally **mutable** object — taps and
  middleware mutate it as the request is built, exactly as PHP does. It is
  created per `send()` call and never shared.
- Long-lived auth state (OAuth tokens that refresh) does **not** live on the
  connector value. It lives in an injected **token store**
  (`tokens: { load, save }` on `defineConnector`); `send` reads/refreshes/writes
  through it. See Slice 7. This is the functional answer to "the class instance
  held the token."

## Naming for diagnostics

Class names previously gave free labels in stack traces, mock matching, and
debug output. Replace with an optional `name` field on `defineConnector`/
`defineRequest` config (used by `MockClient` matching, debugging, and error
messages). Mock matching by "request type" keys off a request's identity/`name`
rather than `instanceof` a class (see Slice 6).

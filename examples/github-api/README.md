# github-api example

A **hallucinated** sketch of the `saloon-js` API — written before the library
exists, to design the public surface we want. The API is **functional (no
classes)**; behavior is still ported from
[SaloonPHP](https://github.com/saloonphp/saloon) (`../saloon`). Full vocabulary
and the PHP→TS mapping live in [`.claude/plans/api-style.md`](../../.claude/plans/api-style.md).

## The shape

- **`defineConnector(config)`** — one per API. Config owns `baseUrl`, `headers`,
  and `auth`. Returns a reusable connector value.
- **`defineRequest<TDto>(config)`** — one per endpoint. Config declares `method`,
  `endpoint`, and optionally `query`, a `body`, and a `dto` mapper. Usually
  wrapped in your own factory function for parameters.
- **`send(connector, request)`** — free function; resolves to a `Response`
  (`.status()`, `.json()`, `.dto()`, `.failed()`).
- **Authenticators / bodies / plugins** — factories: `tokenAuth(...)`,
  `jsonBody(...)`, `acceptsJson()`, etc.
- **Per-call tweaks** — `withHeaders` / `withQuery` / `withAuth` transformers
  (return a new value) instead of subclassing.

```ts
const gitHub = (token: string) =>
  defineConnector({ baseUrl: 'https://api.github.com', auth: tokenAuth(token) });

const listUserRepos = (username: string) =>
  defineRequest<Repo[]>({ method: Method.GET, endpoint: `/users/${username}/repos` });

const response = await send(gitHub(token), listUserRepos('saloonphp'));
const repos = response.dto(); // Repo[]
```

`index.ts` also sketches the OAuth2 authorization-code flow two ways — pure
token threading vs. an injected `tokens: { load, save }` store (the functional
answer to "where does the refreshing token live?").

## Open design questions

- Everything is a `Promise` (no PHP sync/`sendAsync` split) — confirmed direction.
- `withX` transformers as the per-call override surface — is the set
  (`withHeaders/withQuery/withConfig/withBody/withAuth/withMiddleware`) complete?
- Generic `defineRequest<TDto>` to thread the DTO type through to
  `response.dto()` — worth it on every request factory? (Leaning yes.)
- OAuth state: standardize on the `tokens` store, or also keep pure threading as
  a first-class path? (`index.ts` shows both.)

## Run

```bash
pnpm install
GITHUB_TOKEN=... pnpm start
```

Won't run until the API is actually implemented — it's a design target.

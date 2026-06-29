# github-api example

A small real SDK built on `saloon-js`, ported from
[SaloonPHP](https://github.com/saloonphp/saloon). Full vocabulary and the PHP→TS
mapping live in [`.claude/plans/api-style.md`](../../.claude/plans/api-style.md).

`index.ts` is exercised by the smoke test
([`tests/examples/githubApi.test.ts`](../../tests/examples/githubApi.test.ts)),
so it always tracks the shipped public API.

## The shape

- **`defineConnector(config)`** — one per API. Config owns `baseUrl`, `headers`,
  `auth`, and `plugins`. Returns a reusable connector value.
- **`defineRequest<TDto>(config)`** — one per endpoint. Config declares `method`,
  `endpoint`, and optionally `query`, a `body`, and a `dto` mapper. Usually
  wrapped in your own factory function for parameters.
- **`send(connector, request)`** — resolves to a `Response`
  (`.status()`, `.json()`, `.dto()`, `.failed()`, `.toResult()`).
- **Authenticators / bodies / plugins** — factories: `tokenAuth(...)`,
  `jsonBody(...)`, `acceptsJson()`, etc.
- **Per-call tweaks** — `withHeaders` / `withQuery` / `withAuth` transformers
  return a new value with the patch applied.

```ts
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
    dto: (r) => ({ fullName: r.json('full_name'), stars: r.json('stargazers_count') }),
  });

const res = await send(gitHub(token), getRepo('saloonphp', 'saloon'));
const repo = res.dto(); // Repo
```

## Errors are values

4xx/5xx do not throw. Read the failure with `toResult()` and narrow it with a
predicate:

```ts
const result = res.toResult();
if (isErr(result) && isNotFoundError(result.error)) console.error('no such repo');
```

## Run

```bash
pnpm install
GITHUB_TOKEN=… pnpm start
```

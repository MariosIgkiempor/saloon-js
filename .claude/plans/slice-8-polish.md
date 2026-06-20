# Slice 8 — Polish & release

> **API style:** functional, no classes — see `api-style.md`. The public barrel
> exports **functions and types**, not base classes.

## Goal
Ship-ready: a curated public API, documentation, examples, tree-shaking proof, and CI.

## Example (the README quickstart — everything from one barrel)
This is the copy-pastable quickstart the README leads with, and it doubles as the
`examples/github-api` smoke test. It must import only from the public barrel.
```ts
import { defineConnector, defineRequest, send, tokenAuth, acceptsJson, Method, isNotFoundError } from 'saloon-js';

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
    dto: (r) => ({ fullName: r.json('full_name'), stars: r.json('stargazers_count') }),
  });

const res = await send(gitHub(process.env.GITHUB_TOKEN ?? ''), getRepo('saloonphp', 'saloon'));
if (res.failed()) {
  if (isNotFoundError(res.toError())) console.error('no such repo');
} else {
  console.log(`★ ${res.dto().stars}  ${res.dto().fullName}`);
}
```
(`examples/github-api/index.ts` already sketches this — promote it to track the
final barrel exactly, and assert the tree-shaking probe drops `oauth2`/`faking`
when only these symbols are imported.)

## Tasks

### Public barrel `src/index.ts`
Curate named re-exports (no `export *` of internal taps/middleware):
- core: `defineConnector`, `defineRequest`, `send`, `pool`, transformers
  (`withHeaders`/`withQuery`/`withConfig`/`withBody`/`withAuth`/`withMiddleware`/`withRetry`)
- values/factories: `Method`, `PipeOrder`, `fetchSender`/`createFetchSender`, all
  auth factories (`tokenAuth`, …), all plugin factories (`acceptsJson`, …), all body
  factories (`jsonBody`, …)
- faking: `createMockClient`, `mockResponse`, `fixture`, the global-mock helpers
- oauth2: `authorizationUrl`, `exchangeCode`, `refreshAccessToken`, `getOAuthUser`,
  `clientCredentials`, `accessTokenAuth`, `serializeAuth`/`deserializeAuth`,
  `validateOAuthConfig`
- errors: predicate helpers as the primary surface; error classes re-exported for
  `instanceof`
- **types**: `Connector`, `Request`, `Response`, `PendingRequest`, `ConnectorConfig`,
  `RequestConfig`, `Authenticator`, `Plugin`, `BodyRepository`, `Sender`,
  `OAuthConfig`, `TokenStore`, etc.
- Keep `"sideEffects": false` honest: confirm nothing runs work at import time
  (config/global mock use lazy getters/functions).

### Tree-shaking verification
A check (or documented manual step) that importing only `defineConnector`/
`defineRequest`/`send` doesn't pull in `oauth2`/`faking` — e.g. an
`esbuild --bundle --tree-shaking` probe asserting absent symbols. Call out that free
functions tree-shake better than class methods (vs. SaloonPHP's class-based API).

### README.md
- Quickstart: `defineConnector` + `defineRequest`, `send`, read response.
- Sections: connectors/requests, precedence (+ `withX` transformers), body types,
  auth, plugins, middleware, retries, pooling, testing with `createMockClient`/
  fixtures, OAuth2 (config + token store), DTOs, error model (non-throwing default +
  opt-in throw; predicates).
- Divergences from SaloonPHP: functional API (no classes/traits), async-only,
  explicit `plugins` array vs traits, buffered response bodies, errors named
  `*Error` (not `*Exception`) + predicates, OAuth token-store injection vs stateful
  connector, `collect()` differences.

### Examples (`examples/`)
- `github-api/` — already drafted as the functional design target. Promote it to a
  small real SDK used in the smoke test, tracking the final API.

### CI (`.github/workflows/ci.yml`)
- matrix Node 22/24 via `pnpm/action-setup` + `actions/setup-node` (cache: pnpm):
  `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`.

### Release prep
- `LICENSE` (MIT, mirror Saloon), `package.json` metadata (repository, keywords,
  description), `files` correct (ship `dist` only), `prepublishOnly: pnpm build`.

## Done criteria
- `pnpm lint && pnpm typecheck && pnpm build && pnpm test` green on the matrix.
- README quickstart copy-pastes and runs.
- Tree-shaking probe confirms unused subsystems are dropped.
- `pnpm pack`-clean (only `dist` + metadata shipped).

## Reference
- `../saloon/composer.json` (keywords/metadata parity), `../saloon/LICENSE`,
  `../saloon/README.md`

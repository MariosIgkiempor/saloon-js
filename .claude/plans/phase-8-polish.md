# Phase 8 — Polish

> **API style:** functional, no classes — see `api-style.md`. The public barrel
> exports **functions and types**, not base classes.

## Goal
Ship-ready: a curated public API, documentation, examples, and CI.

## Tasks

### Public barrel `src/index.ts`
- Curate named re-exports (no `export *` of internal taps/middleware). Surface:
  - core: `defineConnector`, `defineRequest`, `send`, `pool`, the transformers (`withHeaders`/`withQuery`/`withConfig`/`withBody`/`withAuth`/`withMiddleware`)
  - values/factories: `Method`, `PipeOrder`, `fetchSender`/`createFetchSender`, all auth factories (`tokenAuth`, …), all plugin factories (`acceptsJson`, …), all body factories (`jsonBody`, …)
  - faking: `createMockClient`, `mockResponse`, `fixture`, the global-mock helpers
  - oauth2: `authorizationUrl`, `exchangeCode`, `refreshAccessToken`, `getOAuthUser`, `clientCredentials`, `accessTokenAuth`, `serializeAuth`/`deserializeAuth`, `validateOAuthConfig`
  - errors: the predicate helpers (`isRequestError`, `isNotFoundError`, …) as the primary surface; error classes re-exported for `instanceof`
  - **types**: `Connector`, `Request`, `Response`, `PendingRequest`, `ConnectorConfig`, `RequestConfig`, `Authenticator`, `Plugin`, `BodyRepository`, `Sender`, `OAuthConfig`, `TokenStore`, etc.
- Keep `"sideEffects": false` honest: confirm no module performs work at import time (config/global mock use lazy getters/functions).

### Tree-shaking verification
- Add a check (or documented manual step) that a consumer importing only `defineConnector`/`defineRequest`/`send` doesn't pull in `oauth2`/`faking`. E.g. a tiny bundle-size probe with `esbuild --bundle --tree-shaking` on a fixture entry, asserting absent symbols. (Free functions tree-shake better than the old class methods — call this out as a benefit of the functional API.)

### README.md
- Quickstart: `defineConnector` + `defineRequest`, `send`, read response.
- Sections: connectors/requests, headers/query/config precedence (+ `withX` transformers), body types, auth, plugins, middleware, retries, pooling, testing with `createMockClient`/fixtures, OAuth2 (config + token store), DTOs, error model (non-throwing default + opt-in throw; predicates).
- Note divergences from SaloonPHP: **functional API (no classes/traits — `define*` + free functions)**, async-only, explicit `plugins` array vs traits, buffered response bodies, errors named `*Error` (not `*Exception`) and discriminated via predicates, OAuth token-store injection vs stateful connector, `collect()` differences.

### Examples (`examples/`)
- `github-api/` — already drafted as the functional design target (`index.ts`, with the OAuth2 token-store flow). Promote it to a small real SDK used in the smoke test, tracking the final API.

### CI (`.github/workflows/ci.yml`)
- matrix Node 22/24, using `pnpm/action-setup` + `actions/setup-node` (cache: pnpm): `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`.

### Release prep
- `LICENSE` (MIT, mirror Saloon), `package.json` metadata (repository, keywords, description), `files` correct (ship `dist` only), `prepublishOnly: pnpm build`.

## Done criteria
- `pnpm lint && pnpm typecheck && pnpm build && pnpm test` green on the matrix.
- README quickstart copy-pastes and runs.
- Tree-shaking probe confirms unused subsystems are dropped.
- Package is `pnpm pack`-clean (only `dist` + metadata shipped).

## Reference
- `../saloon/composer.json` (keywords/metadata parity), `../saloon/LICENSE`
- `../saloon/README.md` (doc structure inspiration)

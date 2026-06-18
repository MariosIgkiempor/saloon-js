# Phase 8 — Polish

## Goal
Ship-ready: a curated public API, documentation, examples, and CI.

## Tasks

### Public barrel `src/index.ts`
- Curate named re-exports (no `export *` of internal taps/middleware). Surface: `Connector`, `Request`, `Response`, `PendingRequest`, `Method`, `PipeOrder`, `FetchSender`, all authenticators + factories, all plugins, all body repos + factories, `MockClient`/`MockResponse`/`Fixture`, OAuth2 grants/config/authenticator, the exception classes, `Config`.
- Keep `"sideEffects": false` honest: confirm no module performs work at import time (Config/global mock use lazy getters).

### Tree-shaking verification
- Add a check (or documented manual step) that a consumer importing only `Connector`/`Request` doesn't pull in `oauth2`/`faking`. E.g. a tiny bundle-size probe with `esbuild --bundle --tree-shaking` on a fixture entry, asserting absent symbols.

### README.md
- Quickstart: define a `Connector` + `Request`, send, read response.
- Sections: connectors/requests, headers/query/config precedence, body types, auth, plugins, middleware, retries, pooling, testing with `MockClient`/fixtures, OAuth2, DTOs, error model (non-throwing default + opt-in throw).
- Note divergences from SaloonPHP (async-only, explicit `plugins()` vs traits, buffered response bodies, `collect()` differences).

### Examples (`examples/`)
- `github/` — a small real SDK (`GithubConnector` + a couple requests + a DTO) used in the smoke test.

### CI (`.github/workflows/ci.yml`)
- matrix Node 18/20/22: `npm ci`, `npm run typecheck`, `npm run build`, `npm test`.

### Release prep
- `LICENSE` (MIT, mirror Saloon), `package.json` metadata (repository, keywords, description), `.npmignore`/`files` correct (ship `dist` only), `prepublishOnly: npm run build`.

## Done criteria
- `npm run typecheck && npm run build && npm test` green on the matrix.
- README quickstart copy-pastes and runs.
- Tree-shaking probe confirms unused subsystems are dropped.
- Package is `npm pack`-clean (only `dist` + metadata shipped).

## Reference
- `saloon/composer.json` (keywords/metadata parity), `saloon/LICENSE`
- `saloon/README.md` (doc structure inspiration)

# saloon-js — project house rules

A TypeScript port of [SaloonPHP](https://github.com/saloonphp/saloon). The PHP source lives in a sibling clone at `../saloon` (a standalone checkout, not a git submodule of this repo) and is the reference for every port.

## Toolchain
- **Package manager: pnpm only.** Never run `npm` or `yarn`. Use `pnpm install`, `pnpm add -D <pkg>`, `pnpm <script>`. The `packageManager` field in `package.json` pins the pnpm version (corepack-compatible — run `corepack enable` once).
- **Node: pinned via `.nvmrc` (24).** Run `nvm use` before working. The published `engines.node` floor is `>=22`, so the library stays consumable on both live LTS lines (22 and 24).
- **Lint/format: Biome** (no ESLint, no Prettier).
  - `pnpm lint` — check
  - `pnpm lint:fix` — check + apply fixes
  - `pnpm format` — write formatting
- **Build: tsdown** (Rolldown-powered) — ESM-first dual build (esm + cjs + dts).
- **Tests: Vitest** — specs in `tests/**/*.test.ts`, mirroring `src/` structure.

## Conventions
- **TypeScript is strict.** `noUncheckedIndexedAccess` and `verbatimModuleSyntax` are on. No `any` escape hatches without a comment justifying it.
- **Functional API, no classes.** The public API is functional: users author connectors/requests with `defineConnector`/`defineRequest` and invoke behavior with free functions (`send`, `pool`, OAuth functions). No `class … extends Connector`. Internal machinery (stores, pipeline, pending request, response, sender, mock client) uses **factory functions returning objects**, not classes. The **one carve-out** is Error types, which stay `class … extends Error` (a throwable must) but are discriminated via predicate helpers (`isNotFoundError`, …). Full vocabulary + PHP→TS mapping in `.claude/plans/api-style.md`.
- **Porting discipline.** Each ported module names its PHP source in a header comment (e.g. `// Port of ../saloon/src/Repositories/ArrayStore.php`). Preserve **behavior** — including quirks (e.g. PHP `empty()` semantics where 0 and null are both "empty"). The **structure** intentionally diverges from PHP's class/trait design to the functional API above; the port is behavioral, not structural.
- **Import alias `@/` → `src/`.** Prefer `@/repositories/ArrayStore` over deep relative paths. No file extension needed (`moduleResolution: Bundler`). Wired in `tsconfig.json` (paths), `tsdown.config.ts` (build), and `vitest.config.ts` (tests).
- **Commit `pnpm-lock.yaml`.** Do not ignore it.

## Documentation
- **User-facing docs live in `docs/`** — plain Markdown rendered by GitHub Pages
  (Jekyll, no build step, no deps). Keep it code-example-first and concise.
- **Keep docs in sync with the public API — every PR.** When a PR changes the
  public surface (anything exported from `src/index.ts`: new/renamed/removed
  functions, types, options, or changed behavior), update `docs/` in the **same
  PR**. The invariant is bidirectional: everything exported is documented, and
  everything documented is actually implemented (no aspirational/`hallucinated`
  API — e.g. `dto()`/OAuth stay undocumented until they ship).
- **Before opening a PR**, cross-check `docs/` against `src/index.ts` and fix any
  drift. Verify code samples against the real signatures.

## Common commands
```bash
nvm use                 # match the pinned Node version
pnpm install            # install deps
pnpm typecheck          # tsc --noEmit
pnpm build              # tsdown → dist/
pnpm test               # vitest run
pnpm lint               # biome check
```

## Plans & design docs
The initial build was delivered as **vertical slices** (each ended in a runnable,
tested request); that roadmap is complete and its slice files have been removed.
Current design docs live in `.claude/plans/`:
- `api-style.md` — cross-cutting API style (functional, no classes; return-based errors).
- `data-validation.md` — the `validator` + type-inference feature (function or
  Standard Schema; auto-validation on `send`).

Add a new design doc here when starting a feature beyond the original port.

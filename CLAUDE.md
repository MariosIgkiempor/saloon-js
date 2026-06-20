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

## Common commands
```bash
nvm use                 # match the pinned Node version
pnpm install            # install deps
pnpm typecheck          # tsc --noEmit
pnpm build              # tsdown → dist/
pnpm test               # vitest run
pnpm lint               # biome check
```

## Implementation roadmap
Phased plans live in `.claude/plans/phase-0-skeleton.md` … `phase-8-polish.md`.

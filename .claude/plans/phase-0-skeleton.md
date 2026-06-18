# Phase 0 — Skeleton & primitives

> **Ownership:** You are doing the scaffolding/deps setup yourself. This file documents the agreed setup for reference, then defines the first code primitives (`enums.ts`, `ArrayStore`, `IntegerStore`) which I implement.

## Goal
A buildable, testable TS package at the repo root with the two foundational repositories ported. After this phase: `pnpm typecheck`, `pnpm build`, `pnpm lint`, and `pnpm test` all pass, and the stores are unit-tested.

## House rules (see root `CLAUDE.md`)
- **pnpm** is the only package manager. **nvm** pins Node via `.nvmrc` (24). **Biome** does lint+format (no ESLint/Prettier).

## Scaffolding (you run these)
```bash
cd /Users/mario/Programming/personal/saloon-js
nvm use                       # picks up .nvmrc (24)
corepack enable               # makes pnpm available/pinned
pnpm init
pnpm pkg set type=module name=saloon-js engines.node=">=22" sideEffects=false
pnpm pkg set packageManager="pnpm@9.15.0"   # pin a current pnpm; corepack honors it
pnpm pkg set main=./dist/index.cjs module=./dist/index.js types=./dist/index.d.ts
pnpm pkg set scripts.build=tsdown \
  scripts.typecheck="tsc --noEmit" \
  scripts.test="vitest run" scripts.test:watch=vitest \
  scripts.lint="biome check ." scripts.lint:fix="biome check --write ." \
  scripts.format="biome format --write ."
pnpm add -D typescript tsdown vitest @types/node @biomejs/biome
```
Add to `package.json` manually:
```jsonc
"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" } },
"files": ["dist"]
```

`tsconfig.json`: target ES2022, module ESNext, moduleResolution Bundler, lib `["ES2022","DOM"]`, strict, noUncheckedIndexedAccess, verbatimModuleSyntax, declaration, skipLibCheck, esModuleInterop, outDir dist. `include: ["src"]`, `exclude: ["node_modules","dist","saloon"]`.

`tsdown.config.ts`: entry `src/index.ts`, format `['esm','cjs']`, dts true, treeshake true, clean true, target node22. (Config via tsdown's `defineConfig`.)

`vitest.config.ts`: `test.include: ['tests/**/*.test.ts']`, environment node.

`biome.json`: enable formatter + linter for `src`/`tests`; ignore `dist`, `saloon`, `node_modules`. Recommended rules on; 2-space indent, single quotes.

## Code primitives (I implement)

### `src/enums.ts`
```ts
export enum Method {
  GET = 'GET', HEAD = 'HEAD', POST = 'POST', PUT = 'PUT',
  PATCH = 'PATCH', DELETE = 'DELETE', OPTIONS = 'OPTIONS',
  CONNECT = 'CONNECT', TRACE = 'TRACE',
}
export enum PipeOrder { First = 'first', Last = 'last' }
```

### `src/repositories/ArrayStore.ts`
Port of `saloon/src/Repositories/ArrayStore.php`. Backing `Record<string, unknown>` (generic `<T = unknown>`).
- `constructor(data?: Record<string, T>)`
- `all(): Record<string, T>`
- `get(key, default?)`, `set(data)`, `merge(...arrays)` (later wins, like PHP `array_merge`)
- `add(key, value)`, `remove(key)`, `has(key)`
- `isEmpty()`, `isNotEmpty()`
- Header keys are case-insensitive in HTTP; **defer** case-insensitivity to the headers store usage — keep ArrayStore literal here, handle header casing in PendingRequest/FetchSender (note this decision in Phase 3).

### `src/repositories/IntegerStore.ts`
Port of `IntegerStore.php`. Holds `number | null`.
- `constructor(value?: number | null)`, `set(value)`, `get()`, `isEmpty()` (null/0 → empty per PHP `empty()`), `isNotEmpty()`.

## Tests (`tests/repositories/`)
- `arrayStore.test.ts`: construction with defaults; `merge` precedence (later overrides); `add`/`remove`/`has`/`get` with default; `isEmpty`/`isNotEmpty`.
- `integerStore.test.ts`: null default empty; set/get; `0` treated as empty (match PHP `empty()`); positive value not empty.

## Done criteria
- `pnpm typecheck` clean, `pnpm lint` clean, `pnpm build` emits `dist/{index.js,index.cjs,index.d.ts}`.
- `pnpm test` green for both store specs.
- `src/index.ts` exports `Method`, `PipeOrder`, `ArrayStore`, `IntegerStore`.

## Reference
- `saloon/src/Repositories/ArrayStore.php`, `IntegerStore.php`
- `saloon/src/Enums/Method.php`, `saloon/src/Enums/PipeOrder.php`

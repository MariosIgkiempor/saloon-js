# Phase 1 — Pipeline & contracts

> **API style:** functional, no classes — see `api-style.md`. Contracts are
> interfaces (fine — not classes). The pipeline is a **factory**, not a class.

## Goal
The middleware pipeline machinery and every core interface. Nothing wires together yet, but ordering is unit-tested with stubs and all downstream phases have their types to implement against.

## Files

### `src/helpers/middlewarePipeline.ts`
Port of `../saloon/src/Helpers/MiddlewarePipeline.php`, as a factory. Three internal ordered lists (request / response / fatal). Each pipe = `{ name?: string, order?: PipeOrder, callable }`.
- `export function createMiddlewarePipeline(): MiddlewarePipeline` — returns an object (closure over the three lists) with the methods below; also export a `MiddlewarePipeline` **interface**.
- `onRequest(fn: RequestMiddleware, name?, order?): MiddlewarePipeline` (returns self for chaining)
- `onResponse(fn: ResponseMiddleware, name?, order?): MiddlewarePipeline`
- `onFatalException(fn: (e: FatalRequestError) => void, name?, order?): MiddlewarePipeline`
- `merge(other: MiddlewarePipeline): MiddlewarePipeline`
- `executeRequestPipeline(pending): Promise<PendingRequest>` — runs in order; a pipe returning a `FakeResponse` sets it on pending and continues; supports async pipes (await each).
- `executeResponsePipeline(response): Promise<Response>` — each pipe may return a replacement Response or void.
- `executeFatalPipeline(e): Promise<void>`.
- Returning self (the same object) for chaining is fine and class-free — it reads `pipeline.onRequest(...).onResponse(...)`.
- Ordering: `PipeOrder.First` prepends, `PipeOrder.Last` appends, default appends in registration order. (PHP wraps in static closures to avoid leaks — not needed in JS, but keep pipes as plain functions.)

> Note: PHP has a separate `Pipeline` helper that `MiddlewarePipeline` composes. In TS, fold the simple ordered-list logic directly into `createMiddlewarePipeline` unless a standalone helper proves useful — avoid an empty abstraction.

### `src/contracts/` (interfaces only)
- `Sender.ts`: `interface Sender { send(pending: PendingRequest): Promise<Response>; }` (no PSR factory collection — fetch needs none; drop `getFactoryCollection`).
- `Authenticator.ts`: `interface Authenticator { set(pending: PendingRequest): void; }`
- `Plugin.ts`: `interface Plugin { boot(pending: PendingRequest): void; }`
- `BodyRepository.ts`: `interface BodyRepository<T = unknown> { set(v: T): this; all(): T; isEmpty(): boolean; clone(): BodyRepository<T>; toRequestBody(): { body: BodyInit; contentType: string | null }; }` plus `interface MergeableBody { merge(value: unknown): this; }`
- `FakeResponse.ts`: `interface FakeResponse { status(): number; headers(): ArrayStore; body(): BodyRepository; getError?(pending): Error | undefined; }`
- `RequestMiddleware.ts`: `type RequestMiddleware = (pending: PendingRequest) => PendingRequest | FakeResponse | void | Promise<PendingRequest | FakeResponse | void>;`
- `ResponseMiddleware.ts`: `type ResponseMiddleware = (response: Response) => Response | void | Promise<Response | void>;`
- Also add the **value types** other phases implement against: `Connector` (normalized output of `defineConnector`), `Request<TDto>` (output of `defineRequest`), and the config input types `ConnectorConfig` / `RequestConfig<TDto>`. Stub them minimally here; flesh out in Phase 3.

> Use `import type` for forward references (`PendingRequest`, `Response`, `FatalRequestError`) to avoid runtime cycles — these are types implemented in later phases. Declare minimal placeholder types if needed, replaced in Phase 2/3.

## Tests (`tests/helpers/`)
- `middlewarePipeline.test.ts`:
  - request pipes execute in registration order; `PipeOrder.First`/`Last` honored.
  - a request pipe returning a fake response stops calling the sender (assert via flag) but still continues remaining request pipes per PHP semantics — confirm exact behavior against PHP and document.
  - response pipes can replace or pass through.
  - `merge` concatenates preserving order.
  - async pipes are awaited.

## Done criteria
- All contracts compile and are exported from a `src/contracts/index.ts` barrel.
- Pipeline ordering + async + merge specs green.

## Reference
- `../saloon/src/Helpers/MiddlewarePipeline.php`, `../saloon/src/Helpers/Pipeline.php`
- `../saloon/src/Contracts/{Sender,Authenticator,RequestMiddleware,ResponseMiddleware}.php`
- `../saloon/src/Contracts/Body/{BodyRepository,MergeableBody}.php`

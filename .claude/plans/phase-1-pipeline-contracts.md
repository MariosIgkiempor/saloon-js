# Phase 1 — Pipeline & contracts

## Goal
The middleware pipeline machinery and every core interface. Nothing wires together yet, but ordering is unit-tested with stubs and all downstream phases have their types to implement against.

## Files

### `src/helpers/MiddlewarePipeline.ts`
Port of `saloon/src/Helpers/MiddlewarePipeline.php`. Three internal ordered lists (request / response / fatal). Each pipe = `{ name?: string, order?: PipeOrder, callable }`.
- `onRequest(fn: RequestMiddleware, name?, order?): this`
- `onResponse(fn: ResponseMiddleware, name?, order?): this`
- `onFatalException(fn: (e: FatalRequestException) => void, name?, order?): this`
- `merge(other: MiddlewarePipeline): this`
- `executeRequestPipeline(pending): Promise<PendingRequest>` — runs in order; a pipe returning a `FakeResponse` sets it on pending and continues; supports async pipes (await each).
- `executeResponsePipeline(response): Promise<Response>` — each pipe may return a replacement Response or void.
- `executeFatalPipeline(e): Promise<void>`.
- Ordering: `PipeOrder.First` prepends, `PipeOrder.Last` appends, default appends in registration order. (PHP wraps in static closures to avoid leaks — not needed in JS, but keep pipes as plain functions.)

> Note: PHP has a separate `Pipeline` helper that `MiddlewarePipeline` composes. In TS, fold the simple ordered-list logic directly into `MiddlewarePipeline` unless a standalone `Pipeline` proves useful — avoid an empty abstraction.

### `src/contracts/` (interfaces only)
- `Sender.ts`: `interface Sender { send(pending: PendingRequest): Promise<Response>; }` (no PSR factory collection — fetch needs none; drop `getFactoryCollection`).
- `Authenticator.ts`: `interface Authenticator { set(pending: PendingRequest): void; }`
- `Plugin.ts`: `interface Plugin { boot(pending: PendingRequest): void; }`
- `BodyRepository.ts`: `interface BodyRepository<T = unknown> { set(v: T): this; all(): T; isEmpty(): boolean; clone(): BodyRepository<T>; toRequestBody(): { body: BodyInit; contentType: string | null }; }` plus `interface MergeableBody { merge(value: unknown): this; }`
- `FakeResponse.ts`: `interface FakeResponse { status(): number; headers(): ArrayStore; body(): BodyRepository; getException?(pending): Error | undefined; }`
- `RequestMiddleware.ts`: `type RequestMiddleware = (pending: PendingRequest) => PendingRequest | FakeResponse | void | Promise<PendingRequest | FakeResponse | void>;`
- `ResponseMiddleware.ts`: `type ResponseMiddleware = (response: Response) => Response | void | Promise<Response | void>;`

> Use `import type` for forward references (`PendingRequest`, `Response`, `FatalRequestException`) to avoid runtime cycles — these are types implemented in later phases. Declare minimal placeholder types if needed, replaced in Phase 2/3.

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
- `saloon/src/Helpers/MiddlewarePipeline.php`, `saloon/src/Helpers/Pipeline.php`
- `saloon/src/Contracts/{Sender,Authenticator,RequestMiddleware,ResponseMiddleware}.php`
- `saloon/src/Contracts/Body/{BodyRepository,MergeableBody}.php`

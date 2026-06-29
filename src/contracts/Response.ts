// The reading surface the response factory exposes: keyed `json`, `object`,
// single-header access, the status-class predicates, the return-based failure
// accessor (`toResult`), and the validation surface (`validate`/`validateAsync`/
// `dto`). 4xx/5xx never throw — an error status is a successful round-trip;
// obtaining the failure as a value is `toResult()`.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { RequestError } from '@/errors/RequestError';
import type { ValidationError } from '@/errors/ValidationError';
import type { PendingRequest } from '@/http/pendingRequest';
import type { ArrayStore } from '@/repositories/arrayStore';
import type { Result } from '@/result';

// TDto is the validated response type (inferred from the request's `validator`).
export interface Response<TDto = unknown> {
  /** The HTTP status code. */
  status(): number;
  /** Response headers, as a (case-folded) store. */
  headers(): ArrayStore<string>;
  /** A single header value (case-insensitive), or `undefined` when absent. */
  header(name: string): string | undefined;
  /** The raw response body, buffered once. */
  body(): string;
  /** The body parsed as JSON, as a `Result` — malformed JSON yields `err` (never throws). */
  json<T = unknown>(): Result<T, SyntaxError>;
  /** A dot-path read off the parsed JSON body, falling back to `defaultValue` (also on malformed JSON). */
  json<T = unknown>(key: string, defaultValue?: T): T;
  /** Whole-body JSON as a `Result` (SaloonPHP `object()` parity). */
  object<T = unknown>(): Result<T, SyntaxError>;

  /** `status === 200`. */
  ok(): boolean;
  /** `200 ≤ status < 300`. */
  successful(): boolean;
  /** `300 ≤ status < 400`. */
  redirect(): boolean;
  /** `400 ≤ status < 500`. */
  clientError(): boolean;
  /** `status ≥ 500`. */
  serverError(): boolean;
  /** A failed round-trip: `clientError() || serverError()` (i.e. `status ≥ 400`). */
  failed(): boolean;
  /** Invoke `callback(this)` when `failed()`; returns `this` for chaining. */
  onError(callback: (response: Response<TDto>) => void): Response<TDto>;
  /**
   * The failure as a value: `ok(this)` when not failed, otherwise
   * `err(RequestError)`. The core never throws the `RequestError`.
   */
  toResult(): Result<Response<TDto>, RequestError>;
  /**
   * Throw a `RequestError` when `failed()`, otherwise return `this`. The core
   * never calls this; it is the opt-in escape hatch consumers reach for (and what
   * the `alwaysThrowOnErrors` plugin wires into the response pipeline).
   */
  throw(): Response<TDto>;

  /**
   * Validate the parsed body against the request's `validator` (falling back to
   * the connector's), as a value: `ok(TDto)` or `err(ValidationError)` — never
   * throws. With no validator configured, returns `ok(body as TDto)` (a typed
   * pass-through). An **async** validator yields `err` here; use `validateAsync`.
   * `send` runs this automatically on a successful response.
   */
  validate(): Result<TDto, ValidationError>;
  /** Like `validate()`, but awaits asynchronous validators (e.g. Zod `.refine` with a Promise). */
  validateAsync(): Promise<Result<TDto, ValidationError>>;
  /**
   * The validated body, or **throw** a `ValidationError` when it does not validate
   * (the unwrapped `validate()`). With no validator, returns the parsed body typed
   * as `TDto`.
   */
  dto(): TDto;
  /** Like `dto()`, but throws a `RequestError` first when `failed()`. */
  dtoOrFail(): TDto;

  getPendingRequest(): PendingRequest;
  getRequest(): Request;
  getConnector(): Connector;
  /** The underlying native fetch `Response`. */
  getFetchResponse(): globalThis.Response;
  /** True when this response came from a mock client / fixture. */
  isMocked(): boolean;
  /** True when this response was served from a cache (set by caching, later). */
  isCached(): boolean;
}

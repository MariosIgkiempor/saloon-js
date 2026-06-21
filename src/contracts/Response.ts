// The reading surface the response factory exposes. Slice 3 completes it: keyed
// `json`, `object`, single-header access, the status-class predicates, and the
// return-based failure accessor (`toResult`). 4xx/5xx never throw — an error
// status is a successful round-trip; obtaining the failure as a value is
// `toResult()`. `dto()` arrives in Slice 7.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { RequestError } from '@/errors/RequestError';
import type { PendingRequest } from '@/http/pendingRequest';
import type { ArrayStore } from '@/repositories/arrayStore';
import type { Result } from '@/result';

// TDto threads the DTO type through `onError`/`toResult` here and `dto()` in Slice 7.
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

  getPendingRequest(): PendingRequest;
  getRequest(): Request;
  getConnector(): Connector;
  /** The underlying native fetch `Response`. */
  getFetchResponse(): globalThis.Response;
}

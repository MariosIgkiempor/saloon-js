// The reading surface Slice 1's response factory exposes. Status helpers,
// `throw()`/`toError()` and the keyed `json` overloads arrive in Slice 3; `dto()`
// in Slice 7.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { PendingRequest } from '@/http/pendingRequest';
import type { ArrayStore } from '@/repositories/arrayStore';

// biome-ignore lint/correctness/noUnusedVariables: TDto threads the DTO type to dto() (wired in Slice 7).
export interface Response<TDto = unknown> {
  /** The HTTP status code. */
  status(): number;
  /** Response headers, as a (case-folded) store. */
  headers(): ArrayStore<string>;
  /** The raw response body, buffered once. */
  body(): string;
  /** The body parsed as JSON. */
  json<T = unknown>(): T;
  getPendingRequest(): PendingRequest;
  getRequest(): Request;
  getConnector(): Connector;
  /** The underlying native fetch `Response`. */
  getFetchResponse(): globalThis.Response;
}

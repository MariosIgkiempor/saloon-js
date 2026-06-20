// The normalized request value (out of `defineRequest`) and its input config.
// `TDto` threads the DTO type through to `response.dto()` (wired in Slice 7); in
// Slice 1 it is carried but otherwise inert.

import type { BodyRepository } from '@/contracts/BodyRepository';
import type {
  ConfigValue,
  HeadersConfig,
  HeaderValue,
  QueryConfig,
  QueryValue,
  RequestOptionsConfig,
} from '@/contracts/Connector';
import type { Method } from '@/enums';
import type { ArrayStore } from '@/repositories/arrayStore';

/** The normalized, frozen request produced by `defineRequest`. */
// biome-ignore lint/correctness/noUnusedVariables: TDto threads the DTO type to dto() (wired in Slice 7).
export interface Request<TDto = unknown> {
  method: Method;
  endpoint: string | ((request: Request) => string);
  headers: ArrayStore<HeaderValue>;
  query: ArrayStore<QueryValue>;
  config: ArrayStore<ConfigValue>;
  // Thunk-or-value, like `endpoint`: resolved per-send in MergeBody.
  body?: BodyRepository | (() => BodyRepository);
  allowBaseUrlOverride: boolean;
  name?: string;
}

/** The input accepted by `defineRequest`. */
// biome-ignore lint/correctness/noUnusedVariables: TDto threads the DTO type to dto() (wired in Slice 7).
export interface RequestConfig<TDto = unknown> {
  method: Method;
  endpoint: string | ((request: Request) => string);
  headers?: HeadersConfig;
  query?: QueryConfig;
  config?: RequestOptionsConfig;
  body?: BodyRepository | (() => BodyRepository);
  allowBaseUrlOverride?: boolean;
  name?: string;
}

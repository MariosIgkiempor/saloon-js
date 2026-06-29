// The normalized request value (out of `defineRequest`) and its input config.
// `TDto` threads the DTO type through to `response.dto()` (wired in Slice 7); in
// Slice 1 it is carried but otherwise inert.

import type { BodyRepository } from '@/contracts/BodyRepository';
import type {
  AuthValue,
  BootHook,
  ConfigValue,
  FetchRequestHook,
  HeadersConfig,
  HeaderValue,
  MiddlewareRegistrar,
  QueryConfig,
  QueryValue,
  RequestOptionsConfig,
  RetryHandler,
} from '@/contracts/Connector';
import type { MockClient } from '@/contracts/MockClient';
import type { Plugin } from '@/contracts/Plugin';
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
  // Request auth beats connector auth (see `pendingRequest.getAuthenticator`).
  auth?: AuthValue;
  // Normalized to `[]` by `defineRequest`, so the boot tap can iterate freely.
  plugins: Plugin[];
  middleware?: MiddlewareRegistrar;
  boot?: BootHook;
  handleFetchRequest?: FetchRequestHook;
  mockClient?: MockClient;
  // Resilience knobs (read by the retry loop in `send`); these override connector.
  tries?: number;
  retryInterval?: number;
  useExponentialBackoff?: boolean;
  throwOnMaxTries?: boolean;
  handleRetry?: RetryHandler;
  // Milliseconds to delay before sending (applied by the delay middleware).
  delay?: number;
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
  auth?: AuthValue;
  plugins?: Plugin[];
  middleware?: MiddlewareRegistrar;
  boot?: BootHook;
  handleFetchRequest?: FetchRequestHook;
  mockClient?: MockClient;
  tries?: number;
  retryInterval?: number;
  useExponentialBackoff?: boolean;
  throwOnMaxTries?: boolean;
  handleRetry?: RetryHandler;
  delay?: number;
  allowBaseUrlOverride?: boolean;
  name?: string;
}

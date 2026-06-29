// The normalized request value (out of `defineRequest`) and its input config.
// `TDto` is the validated response type: it is inferred from the request's
// `validator` (see `defineRequest`) and threaded through to `response.dto()` /
// `response.validate()`.

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
import type { Validator } from '@/contracts/Validator';
import type { Method } from '@/enums';
import type { ArrayStore } from '@/repositories/arrayStore';

/** The normalized, frozen request produced by `defineRequest`. */
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
  // Validates + casts this request's response body into `TDto`, run automatically
  // by `send` and read by `response.validate()`/`dto()`. A function (throws on
  // invalid) or any Standard Schema. A connector-level `validator` is the fallback
  // when this is absent. Covariant in `TDto`, so a `Request<User>` stays assignable
  // to `Request<unknown>`.
  validator?: Validator<TDto>;
  name?: string;
}

/** The input accepted by `defineRequest`. */
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
  validator?: Validator<TDto>;
  name?: string;
}

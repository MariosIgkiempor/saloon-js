// Port of ../saloon/src/Http/Request.php (the resolve/default surface)

import type { ConfigValue, HeaderValue, QueryValue } from '@/contracts/Connector';
import type { Request, RequestConfig } from '@/contracts/Request';
import { createArrayStore } from '@/repositories/arrayStore';

/**
 * Normalize request config into a frozen value (usually via your own factory).
 *
 * The response type is **inferred from `config.validator`** — pass a validator
 * function or any Standard Schema (Zod/Valibot/…) and the result is typed
 * `Request<TDto>` without an explicit type argument (an inline `validator`'s
 * `data` parameter is contextually typed `unknown`). Absent a validator, the
 * request is `Request<unknown>`.
 */
export function defineRequest<TDto = unknown>(config: RequestConfig<TDto>): Request<TDto> {
  const request: Request<TDto> = {
    method: config.method,
    endpoint: config.endpoint,
    headers: createArrayStore<HeaderValue>(config.headers),
    query: createArrayStore<QueryValue>(config.query),
    config: createArrayStore<ConfigValue>(config.config),
    body: config.body,
    auth: config.auth,
    plugins: config.plugins ?? [],
    middleware: config.middleware,
    boot: config.boot,
    handleFetchRequest: config.handleFetchRequest,
    mockClient: config.mockClient,
    tries: config.tries,
    retryInterval: config.retryInterval,
    useExponentialBackoff: config.useExponentialBackoff,
    throwOnMaxTries: config.throwOnMaxTries,
    handleRetry: config.handleRetry,
    delay: config.delay,
    allowBaseUrlOverride: config.allowBaseUrlOverride ?? false,
    validator: config.validator,
    name: config.name,
  };

  return Object.freeze(request);
}

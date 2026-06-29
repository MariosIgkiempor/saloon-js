// Port of ../saloon/src/Http/Request.php (the resolve/default surface)

import type { ConfigValue, HeaderValue, QueryValue } from '@/contracts/Connector';
import type { Request, RequestConfig } from '@/contracts/Request';
import { createArrayStore } from '@/repositories/arrayStore';

/** Normalize request config into a frozen value (usually via your own factory). */
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
    dto: config.dto,
    name: config.name,
  };

  return Object.freeze(request);
}

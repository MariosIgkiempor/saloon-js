// Port of ../saloon/src/Http/Request.php (the resolve/default surface)

import type { HeaderValue, QueryValue } from '@/contracts/Connector';
import type { Request, RequestConfig } from '@/contracts/Request';
import { createArrayStore } from '@/repositories/arrayStore';

/** Normalize request config into a frozen value (usually via your own factory). */
export function defineRequest<TDto = unknown>(config: RequestConfig<TDto>): Request<TDto> {
  const request: Request<TDto> = {
    method: config.method,
    endpoint: config.endpoint,
    headers: createArrayStore<HeaderValue>(config.headers),
    query: createArrayStore<QueryValue>(config.query),
    allowBaseUrlOverride: config.allowBaseUrlOverride ?? false,
    name: config.name,
  };

  return Object.freeze(request);
}

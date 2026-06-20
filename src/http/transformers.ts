// Per-call tweaks that PHP did via subclassing become immutable transformers.
// Each returns a NEW frozen value (never mutates the original) and is generic over
// `Connector | Request`. The patch wins within the returned value's store, so a
// transformer applied to the request wins over both connector and request defaults.
// (`withAuth`/`withMiddleware` arrive in Slice 4 with the fields they operate on.)

import type { BodyRepository } from '@/contracts/BodyRepository';
import type {
  Connector,
  HeadersConfig,
  QueryConfig,
  RequestOptionsConfig,
} from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import { createArrayStore } from '@/repositories/arrayStore';

type Target = Connector | Request;

// Spreading the generic union `T` collapses to an index signature, so a direct
// `as T` is rejected; we re-assert `T` through `unknown`. Each transformer swaps a
// single field for a type-compatible value, so the original shape is preserved.
export function withHeaders<T extends Target>(target: T, patch: HeadersConfig): T {
  return Object.freeze({
    ...target,
    headers: createArrayStore(target.headers.all()).merge(patch),
  }) as unknown as T;
}

export function withQuery<T extends Target>(target: T, patch: QueryConfig): T {
  return Object.freeze({
    ...target,
    query: createArrayStore(target.query.all()).merge(patch),
  }) as unknown as T;
}

export function withConfig<T extends Target>(target: T, patch: RequestOptionsConfig): T {
  return Object.freeze({
    ...target,
    config: createArrayStore(target.config.all()).merge(patch),
  }) as unknown as T;
}

export function withBody<T extends Target>(
  target: T,
  body: BodyRepository | (() => BodyRepository),
): T {
  return Object.freeze({ ...target, body }) as unknown as T;
}

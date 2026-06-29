// Per-call tweaks that PHP did via subclassing become immutable transformers.
// Each returns a NEW frozen value (never mutates the original) and is generic over
// `Connector | Request`. The patch wins within the returned value's store, so a
// transformer applied to the request wins over both connector and request defaults.

import type { BodyRepository } from '@/contracts/BodyRepository';
import type {
  AuthValue,
  Connector,
  HeadersConfig,
  MiddlewareRegistrar,
  QueryConfig,
  RequestOptionsConfig,
  RetryConfig,
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

/** Override the authenticator for a single call (beats connector/request auth). */
export function withAuth<T extends Target>(target: T, auth: AuthValue): T {
  return Object.freeze({ ...target, auth }) as unknown as T;
}

/** Patch the retry knobs for a single call (e.g. `withRetry(req, { tries: 5 })`). */
export function withRetry<T extends Target>(target: T, patch: RetryConfig): T {
  return Object.freeze({ ...target, ...patch }) as unknown as T;
}

/** Register ad-hoc middleware for a single call (composed after any existing). */
export function withMiddleware<T extends Target>(target: T, middleware: MiddlewareRegistrar): T {
  const existing = target.middleware;
  const composed: MiddlewareRegistrar = existing
    ? (pipeline) => {
        existing(pipeline);
        middleware(pipeline);
      }
    : middleware;
  return Object.freeze({ ...target, middleware: composed }) as unknown as T;
}

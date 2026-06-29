// Port of ../saloon/src/Http/Pool.php (semantics, not the Guzzle `EachPromise` impl)
//
// A bounded-concurrency runner over a stream of requests, exposed as a **free
// function** returning a controller object (factory, not class). N workers pull
// from a shared, lazily-consumed iterator; each runs `send(connector, request)`
// and dispatches `onResponse(response, key)` / `onError(reason, key)`.
//
// `requests` may be an iterable, an async iterable, or a function producing one —
// resolved at `send()` time so any generator/middleware runs then, not at build
// time. Pulls are serialized so a single generator is never advanced
// concurrently (which would throw), and the key is its 0-based pull order.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { Response } from '@/contracts/Response';
import { send } from '@/http/send';

/** Identifies an item within the pool — its 0-based position in pull order. */
export type PoolKey = number;

/** The request source: an (async) iterable, or a function producing one. */
export type PoolRequests =
  | Iterable<Request>
  | AsyncIterable<Request>
  | ((connector: Connector) => Iterable<Request> | AsyncIterable<Request>);

export type PoolResponseHandler = (response: Response, key: PoolKey) => void | Promise<void>;
export type PoolErrorHandler = (reason: unknown, key: PoolKey) => void | Promise<void>;

export interface PoolOptions {
  requests: PoolRequests;
  /** Max simultaneous in-flight requests (number or thunk). Defaults to 5. */
  concurrency?: number | (() => number);
  onResponse?: PoolResponseHandler;
  onError?: PoolErrorHandler;
}

/** The controller returned by `pool` — configure then `send()`. */
export interface Pool {
  withResponseHandler(handler: PoolResponseHandler): Pool;
  withErrorHandler(handler: PoolErrorHandler): Pool;
  setConcurrency(concurrency: number | (() => number)): Pool;
  /** Drain the pool: resolves once every request has settled. */
  send(): Promise<void>;
}

export function pool(connector: Connector, options: PoolOptions): Pool {
  const { requests } = options;
  let concurrency: number | (() => number) = options.concurrency ?? 5;
  let onResponse = options.onResponse;
  let onError = options.onError;

  const api: Pool = {
    withResponseHandler(handler) {
      onResponse = handler;
      return api;
    },
    withErrorHandler(handler) {
      onError = handler;
      return api;
    },
    setConcurrency(next) {
      concurrency = next;
      return api;
    },
    async send() {
      const source = typeof requests === 'function' ? requests(connector) : requests;
      const iterator = getIterator(source);

      // Serialize pulls: chain each `next()` after the previous so a single
      // generator is never advanced concurrently. The key is the pull order.
      let key = 0;
      let chain: Promise<unknown> = Promise.resolve();
      const pull = (): Promise<{ request: Request; key: PoolKey } | null> => {
        const result = chain.then(async () => {
          const next = await iterator.next();
          if (next.done) return null;
          return { request: next.value, key: key++ };
        });
        // Keep the chain alive regardless of this pull's outcome.
        chain = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      };

      const worker = async (): Promise<void> => {
        for (;;) {
          const item = await pull();
          if (item === null) return;
          try {
            const response = await send(connector, item.request);
            await onResponse?.(response, item.key);
          } catch (reason) {
            await onError?.(reason, item.key);
          }
        }
      };

      const width = Math.max(1, typeof concurrency === 'function' ? concurrency() : concurrency);
      await Promise.all(Array.from({ length: width }, () => worker()));
    },
  };

  return api;
}

/** Normalize any (sync or async) iterable into an iterator whose `next()` we await. */
function getIterator(
  source: Iterable<Request> | AsyncIterable<Request>,
): Iterator<Request> | AsyncIterator<Request> {
  if (Symbol.asyncIterator in source) return source[Symbol.asyncIterator]();
  return source[Symbol.iterator]();
}

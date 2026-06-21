// biome-ignore-all lint/suspicious/noConfusingVoidType: the middleware return
// unions below intentionally include `void` — a pipe may legitimately return
// nothing (mutating in place), sync or async, so a void-returning callback must
// stay assignable. `undefined` would reject a `(p) => { … }` block-body callback.
//
// Port of ../saloon/src/Helpers/MiddlewarePipeline.php + ../saloon/src/Helpers/Pipeline.php
// (folded together — PHP's separate `Pipeline` is inlined, no empty abstraction).
//
// A factory closing over three ordered pipe lists (request / response / fatal):
//   - a request pipe may mutate the pending request in place and return void,
//     return a replacement PendingRequest, or return a FakeResponse — the last
//     stashes the fake on the pending and short-circuits the real sender (the
//     mock/fake materialization itself lands in Slice 6);
//   - a response pipe may return a replacement Response or void (pass through);
//   - a fatal pipe observes a transport error.
//
// Ordering mirrors PHP's Pipeline: `PipeOrder.First` prepends, `Last`/default
// appends in registration order. (PHP's duplicate-pipe-name guard is dropped: per
// the error policy only the network failure throws, and names here are purely
// diagnostic.) `merge` straight-concatenates another pipeline's pipes, preserving
// the order each already resolved to.

import type { FakeResponse } from '@/contracts/FakeResponse';
import { isFakeResponse } from '@/contracts/FakeResponse';
import type { Response } from '@/contracts/Response';
import { PipeOrder } from '@/enums';
import type { PendingRequest } from '@/http/pendingRequest';

export type RequestMiddleware = (
  pending: PendingRequest,
) => PendingRequest | FakeResponse | void | Promise<PendingRequest | FakeResponse | void>;

export type ResponseMiddleware = (response: Response) => Response | void | Promise<Response | void>;

export type FatalMiddleware = (error: Error) => void | Promise<void>;

interface Pipe<F> {
  callable: F;
  name?: string;
  order?: PipeOrder;
}

export interface MiddlewarePipeline {
  /** Register a request pipe. Returns self for chaining. */
  onRequest(callable: RequestMiddleware, name?: string, order?: PipeOrder): MiddlewarePipeline;
  /** Register a response pipe. Returns self for chaining. */
  onResponse(callable: ResponseMiddleware, name?: string, order?: PipeOrder): MiddlewarePipeline;
  /** Register a fatal-exception pipe. Returns self for chaining. */
  onFatalException(callable: FatalMiddleware, name?: string, order?: PipeOrder): MiddlewarePipeline;
  /** Append another pipeline's pipes to this one (preserving order). */
  merge(other: MiddlewarePipeline): MiddlewarePipeline;
  /** Run request pipes in order; returns the (possibly replaced) pending request. */
  executeRequestPipeline(pending: PendingRequest): Promise<PendingRequest>;
  /** Run response pipes in order; returns the (possibly replaced) response. */
  executeResponsePipeline(response: Response): Promise<Response>;
  /** Run fatal pipes in order. */
  executeFatalPipeline(error: Error): Promise<void>;
}

interface PipelineState {
  request: Pipe<RequestMiddleware>[];
  response: Pipe<ResponseMiddleware>[];
  fatal: Pipe<FatalMiddleware>[];
}

// Per-instance pipe lists, kept off the public object so the interface stays clean
// while `merge` can still read another instance's pipes.
const internals = new WeakMap<MiddlewarePipeline, PipelineState>();

function insert<F>(list: Pipe<F>[], pipe: Pipe<F>): void {
  if (pipe.order === PipeOrder.First) list.unshift(pipe);
  else list.push(pipe);
}

export function createMiddlewarePipeline(): MiddlewarePipeline {
  const state: PipelineState = { request: [], response: [], fatal: [] };

  const api: MiddlewarePipeline = {
    onRequest(callable, name, order) {
      insert(state.request, { callable, name, order });
      return api;
    },
    onResponse(callable, name, order) {
      insert(state.response, { callable, name, order });
      return api;
    },
    onFatalException(callable, name, order) {
      insert(state.fatal, { callable, name, order });
      return api;
    },
    merge(other) {
      const otherState = internals.get(other);
      if (otherState) {
        state.request.push(...otherState.request);
        state.response.push(...otherState.response);
        state.fatal.push(...otherState.fatal);
      }
      return api;
    },
    async executeRequestPipeline(pending) {
      let current = pending;
      for (const pipe of state.request) {
        const result = await pipe.callable(current);
        if (isFakeResponse(result)) {
          // PHP semantics: stash the fake response and keep running the remaining
          // request pipes (they may still inspect/augment the pending request).
          current.setFakeResponse(result);
          continue;
        }
        if (result) current = result;
      }
      return current;
    },
    async executeResponsePipeline(response) {
      let current = response;
      for (const pipe of state.response) {
        const result = await pipe.callable(current);
        if (result) current = result;
      }
      return current;
    },
    async executeFatalPipeline(error) {
      for (const pipe of state.fatal) {
        await pipe.callable(error);
      }
    },
  };

  internals.set(api, state);
  return api;
}

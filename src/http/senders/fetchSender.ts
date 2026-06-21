// Port of ../saloon/src/Http/Senders/GuzzleSender.php (fetch-based)
//
// A sender is just `{ send }`. It drives an `AbortController` from the timeouts in
// the pending request's config (seeded by `hasTimeout` or falling back to the
// `config` defaults):
//   - `connectTimeout` guards time-to-response-start (fetch has no separate connect
//     phase, so this is "headers haven't arrived yet"); cleared once they do.
//   - `timeout` guards the whole exchange, including reading the body.
// On abort — or any transport failure — it throws `FatalRequestError`. 4xx/5xx
// responses do NOT throw here (that is a successful round-trip).

import { getDefaultConnectTimeout, getDefaultRequestTimeout } from '@/config';
import type { Sender } from '@/contracts/Sender';
import { FatalRequestError } from '@/errors/FatalRequestError';
import type { PendingRequest } from '@/http/pendingRequest';

export interface FetchSenderOptions {
  /** Inject a custom fetch (defaults to the global). */
  fetch?: typeof fetch;
}

function readTimeout(value: unknown, fallback: number): number {
  return typeof value === 'number' && value > 0 ? value : fallback;
}

/** Prefer the abort reason (our timeout error) over fetch's generic AbortError. */
function failureCause(controller: AbortController, error: unknown): unknown {
  return controller.signal.aborted ? controller.signal.reason : error;
}

export function createFetchSender(options: FetchSenderOptions = {}): Sender {
  return {
    async send(pending: PendingRequest) {
      const { url, init } = pending.createFetchRequest();
      const doFetch = options.fetch ?? fetch;

      const connectTimeout = readTimeout(
        pending.config.get('connectTimeout'),
        getDefaultConnectTimeout(),
      );
      const requestTimeout = readTimeout(pending.config.get('timeout'), getDefaultRequestTimeout());

      const controller = new AbortController();
      // Honor a signal supplied by a fetch hook by combining it with ours.
      init.signal =
        init.signal != null ? AbortSignal.any([controller.signal, init.signal]) : controller.signal;

      let connectTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
        controller.abort(new Error(`Connection timed out after ${connectTimeout}ms`));
      }, connectTimeout);
      let requestTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
        controller.abort(new Error(`Request timed out after ${requestTimeout}ms`));
      }, requestTimeout);
      const clearConnectTimer = () => {
        if (connectTimer !== undefined) {
          clearTimeout(connectTimer);
          connectTimer = undefined;
        }
      };
      const clearRequestTimer = () => {
        if (requestTimer !== undefined) {
          clearTimeout(requestTimer);
          requestTimer = undefined;
        }
      };

      let res: globalThis.Response;
      try {
        res = await doFetch(url, init);
      } catch (error) {
        clearConnectTimer();
        clearRequestTimer();
        throw new FatalRequestError(failureCause(controller, error), pending);
      }
      clearConnectTimer();

      try {
        const response = await pending.getResponseFactory()(res, pending, init);
        clearRequestTimer();
        return response;
      } catch (error) {
        clearRequestTimer();
        throw new FatalRequestError(failureCause(controller, error), pending);
      }
    },
  };
}

export const fetchSender: Sender = createFetchSender();

// Port of ../saloon/src/Http/Senders/GuzzleSender.php (fetch-based)
//
// A sender is just `{ send }`. Transport failures throw `FatalRequestError`; 4xx/
// 5xx responses do NOT throw here — status handling lands in Slice 3.

import type { Sender } from '@/contracts/Sender';
import { FatalRequestError } from '@/errors/FatalRequestError';
import type { PendingRequest } from '@/http/pendingRequest';

export interface FetchSenderOptions {
  /** Inject a custom fetch (defaults to the global). */
  fetch?: typeof fetch;
}

export function createFetchSender(options: FetchSenderOptions = {}): Sender {
  return {
    async send(pending: PendingRequest) {
      const { url, init } = pending.createFetchRequest();
      const doFetch = options.fetch ?? fetch;

      let res: globalThis.Response;
      try {
        res = await doFetch(url, init);
      } catch (error) {
        throw new FatalRequestError(error, pending);
      }

      return pending.getResponseFactory()(res, pending, init);
    },
  };
}

export const fetchSender: Sender = createFetchSender();

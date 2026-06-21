// Port of ../saloon/src/Traits/Plugins/HasTimeout.php
//
// Writes the timeouts into the pending request's config; the fetch sender reads
// them to drive its `AbortController` (see `senders/fetchSender`). Values are in
// **milliseconds** (JS convention), unlike Guzzle's seconds.

import type { Plugin } from '@/contracts/Plugin';
import type { PendingRequest } from '@/http/pendingRequest';

export interface TimeoutOptions {
  /** Max ms to establish the connection / receive the response start. */
  connect?: number;
  /** Max ms for the whole request, including reading the body. */
  request?: number;
}

export function hasTimeout(options: TimeoutOptions = {}): Plugin {
  return {
    boot(pending: PendingRequest): void {
      if (options.connect !== undefined) pending.config.add('connectTimeout', options.connect);
      if (options.request !== undefined) pending.config.add('timeout', options.request);
    },
  };
}

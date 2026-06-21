// Port of ../saloon/src/Traits/Plugins/AcceptsJson.php

import type { Plugin } from '@/contracts/Plugin';
import type { PendingRequest } from '@/http/pendingRequest';

/** Sends `Accept: application/json`. */
export function acceptsJson(): Plugin {
  return {
    boot(pending: PendingRequest): void {
      pending.headers.add('Accept', 'application/json');
    },
  };
}

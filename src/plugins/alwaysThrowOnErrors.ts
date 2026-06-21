// Port of ../saloon/src/Traits/Plugins/AlwaysThrowOnErrors.php
//
// Opt-in: registers a response pipe (ordered last) that calls `response.throw()`,
// turning any failed (4xx/5xx) round-trip into a thrown `RequestError`. This is the
// deliberate exception to the return-based error policy — the consumer asked for it.

import type { Plugin } from '@/contracts/Plugin';
import { PipeOrder } from '@/enums';
import type { PendingRequest } from '@/http/pendingRequest';

export function alwaysThrowOnErrors(): Plugin {
  return {
    boot(pending: PendingRequest): void {
      pending.middleware.onResponse(
        (response) => response.throw(),
        'alwaysThrowOnErrors',
        PipeOrder.Last,
      );
    },
  };
}

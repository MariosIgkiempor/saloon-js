// Port of ../saloon/src/Http/PendingRequest/MergeDelay.php
//
// Seed `pending.delay` from the connector's delay, then let the request override
// it when set. The delay middleware (registered last in the request pipeline)
// reads this store and awaits it before the sender runs.

import type { PendingRequest } from '@/http/pendingRequest';

export function mergeDelay(pending: PendingRequest): void {
  const connector = pending.getConnector();
  const request = pending.getRequest();

  // Request delay wins when present; otherwise fall back to the connector's.
  const delay = request.delay ?? connector.delay ?? null;
  pending.delay.set(delay);
}

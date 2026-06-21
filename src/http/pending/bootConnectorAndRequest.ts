// Port of ../saloon/src/Http/PendingRequest/BootConnectorAndRequest.php
//
// The last sync tap: run the connector's then the request's `boot` hook. These are
// the functional replacement for PHP's `boot(PendingRequest $pendingRequest)`
// override — a final, imperative chance to tweak the pending request.

import type { PendingRequest } from '@/http/pendingRequest';

export function bootConnectorAndRequest(pending: PendingRequest): void {
  pending.getConnector().boot?.(pending);
  pending.getRequest().boot?.(pending);
}

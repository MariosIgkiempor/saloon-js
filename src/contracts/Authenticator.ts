// Port of ../saloon/src/Contracts/Authenticator.php
//
// An authenticator applies credentials to the pending request. Each is a factory
// returning `{ set }` (see `src/auth/*`). It runs in the `authenticate` tap, after
// properties/body merge, so it sees (and can override) the merged headers/query.

import type { PendingRequest } from '@/http/pendingRequest';

export interface Authenticator {
  /** Apply credentials to the pending request (a header, a query param, …). */
  set(pending: PendingRequest): void;
}

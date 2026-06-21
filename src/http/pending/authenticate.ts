// Port of ../saloon/src/Http/PendingRequest/AuthenticateRequest.php
//
// Runs after properties/body merge so the authenticator sees (and can override)
// the merged headers/query. The resolved authenticator is request-auth ?? connector
// -auth (see `pendingRequest.getAuthenticator`); when neither is set this is a no-op.

import type { PendingRequest } from '@/http/pendingRequest';

export function authenticate(pending: PendingRequest): void {
  pending.getAuthenticator()?.set(pending);
}

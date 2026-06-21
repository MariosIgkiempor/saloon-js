// Port of ../saloon/src/Http/Auth/TokenAuthenticator.php

import type { Authenticator } from '@/contracts/Authenticator';
import type { PendingRequest } from '@/http/pendingRequest';

/** `Authorization: <prefix> <token>` (default prefix `Bearer`). */
export function tokenAuth(token: string, prefix = 'Bearer'): Authenticator {
  return {
    set(pending: PendingRequest): void {
      pending.headers.add('Authorization', `${prefix} ${token}`.trim());
    },
  };
}

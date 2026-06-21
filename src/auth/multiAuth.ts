// Port of ../saloon/src/Http/Auth/MultiAuthenticator.php

import type { Authenticator } from '@/contracts/Authenticator';
import type { PendingRequest } from '@/http/pendingRequest';

/** Applies several authenticators in order (each `set` runs on the pending request). */
export function multiAuth(...authenticators: Authenticator[]): Authenticator {
  return {
    set(pending: PendingRequest): void {
      for (const authenticator of authenticators) authenticator.set(pending);
    },
  };
}

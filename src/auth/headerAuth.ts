// Port of ../saloon/src/Http/Auth/HeaderAuthenticator.php

import type { Authenticator } from '@/contracts/Authenticator';
import type { PendingRequest } from '@/http/pendingRequest';

/** Sets `<headerName>: <accessToken>` (default header `Authorization`). */
export function headerAuth(accessToken: string, headerName = 'Authorization'): Authenticator {
  return {
    set(pending: PendingRequest): void {
      pending.headers.add(headerName, accessToken);
    },
  };
}

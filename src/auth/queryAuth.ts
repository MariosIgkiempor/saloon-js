// Port of ../saloon/src/Http/Auth/QueryAuthenticator.php

import type { Authenticator } from '@/contracts/Authenticator';
import type { PendingRequest } from '@/http/pendingRequest';

/** Adds `<name>=<value>` to the query string. */
export function queryAuth(name: string, value: string): Authenticator {
  return {
    set(pending: PendingRequest): void {
      pending.query.add(name, value);
    },
  };
}

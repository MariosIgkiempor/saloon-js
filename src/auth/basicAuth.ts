// Port of ../saloon/src/Http/Auth/BasicAuthenticator.php

import type { Authenticator } from '@/contracts/Authenticator';
import { toBase64 } from '@/helpers/base64';
import type { PendingRequest } from '@/http/pendingRequest';

/** `Authorization: Basic base64(username:password)`. */
export function basicAuth(username: string, password: string): Authenticator {
  return {
    set(pending: PendingRequest): void {
      pending.headers.add('Authorization', `Basic ${toBase64(`${username}:${password}`)}`);
    },
  };
}

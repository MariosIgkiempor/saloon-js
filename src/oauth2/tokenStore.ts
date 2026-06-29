// The token store — the functional answer to "the class instance held the token".
//
// When a connector carries `tokens`, `send` calls `resolveTokenStoreAuth` before
// dispatch: it loads the persisted authenticator, refreshes it when expired and
// refreshable (saving the fresh one), and threads it in as the call's auth. An
// explicit `options.auth`/`request.auth` always wins, and `skipTokenStore` (set
// by the internal grant requests) opts out entirely to avoid recursion.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { SendOptions } from '@/http/pendingRequest';
import {
  hasExpired,
  isRefreshable,
  type OAuthAuthenticator,
} from '@/oauth2/accessTokenAuthenticator';
import { refreshAccessToken } from '@/oauth2/authorizationCodeGrant';

export interface TokenStore {
  load(): OAuthAuthenticator | null | Promise<OAuthAuthenticator | null>;
  save(auth: OAuthAuthenticator): void | Promise<void>;
}

export async function resolveTokenStoreAuth<TDto>(
  connector: Connector,
  request: Request<TDto>,
  options: SendOptions,
): Promise<SendOptions> {
  const store = connector.tokens;
  if (!store || options.skipTokenStore) return options;
  // An explicitly-threaded authenticator beats the store.
  if (options.auth || request.auth) return options;

  let auth = await store.load();
  if (!auth) return options;

  if (hasExpired(auth) && isRefreshable(auth)) {
    auth = await refreshAccessToken(connector, auth);
    await store.save(auth);
  }

  return { ...options, auth };
}

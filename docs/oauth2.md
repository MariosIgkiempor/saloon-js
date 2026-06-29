# OAuth2

saloon-js ships both common OAuth2 grants. You call them with a connector that
carries an `oauth` config — there's no stateful instance to hold the tokens, so
the CSRF `state` and the access token are values you pass around (or hand to a
**token store** that does it for you).

```ts
import { defineConnector } from 'saloon-js';
import type { OAuthConfig } from 'saloon-js';

const oauth: OAuthConfig = {
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  redirectUri: 'https://app.example.com/callback',
  defaultScopes: ['user:read'],
  // Optional (defaults shown): authorizeEndpoint 'authorize', tokenEndpoint
  // 'token', userEndpoint 'user', scopeSeparator ' ', allowBaseUrlOverride false.
};

const api = defineConnector({ baseUrl: 'https://api.example.com', oauth });
```

> `allowBaseUrlOverride` defaults to **false** on purpose: it stops an absolute
> `tokenEndpoint`/`userEndpoint` from redirecting token requests off your base
> URL (an SSRF guard). Only enable it if you intend an absolute endpoint.

## Authorization Code grant

```ts
import { authorizationUrl, exchangeCode, refreshAccessToken } from 'saloon-js';
import { serializeAuth, deserializeAuth, hasExpired, isRefreshable } from 'saloon-js';

// 1) Redirect the user; stash the returned CSRF state.
const { url, state } = authorizationUrl(api, { scopes: ['user:read'] });
// → redirect to `url`, persist `state` against the user's session.

// 2) On the callback, exchange the code. Pass BOTH the state from the
//    callback query and the state you stashed — a mismatch throws InvalidStateError.
let auth = await exchangeCode(api, callbackCode, {
  state: callbackState,
  expectedState: state,
});

const persisted = serializeAuth(auth);   // a string you store yourself

// 3) Later: rehydrate, refresh if needed, and use it.
auth = deserializeAuth(persisted);
if (hasExpired(auth) && isRefreshable(auth)) {
  auth = await refreshAccessToken(api, auth);   // also accepts a bare refresh-token string
}
```

`exchangeCode`/`refreshAccessToken` return an `OAuthAuthenticator` — a normal
authenticator (it adds `Authorization: Bearer …`) plus `accessToken`,
`refreshToken`, and `expiresAt`. Pass `{ returnResponse: true }` to get the raw
`Response` instead.

Use it like any authenticator:

```ts
import { withAuth, send } from 'saloon-js';

await send(api, withAuth(getMe(), auth));
```

`getOAuthUser(api, auth)` is a shortcut that GETs the configured `userEndpoint`
with the bearer token applied.

## Client Credentials grant

```ts
import { clientCredentials } from 'saloon-js';

const auth = await clientCredentials(api, { scopes: ['read'] });

// Send the client id/secret via HTTP Basic auth instead of the form body:
const auth2 = await clientCredentials(api, { basicAuth: true });
```

## Token store — automatic threading

Instead of threading the authenticator yourself, give the connector a `tokens`
store. Before each send, saloon-js loads the authenticator, refreshes it when it
has expired (and is refreshable), saves the fresh one, and applies it — unless
the call already supplies an explicit auth.

```ts
const api = defineConnector({
  baseUrl: 'https://api.example.com',
  oauth,
  tokens: {
    load: () => (persisted ? deserializeAuth(persisted) : null),
    save: (auth) => { persisted = serializeAuth(auth); },
  },
});

await send(api, getMe());   // loads → refreshes if needed → saves → applies the bearer
```

`load`/`save` may be sync or async. An explicit `options.auth` or request-level
auth always wins over the store.

## State validation

`exchangeCode` mirrors SaloonPHP: it throws `InvalidStateError` only when **both**
`state` and `expectedState` are non-empty and they differ. If either is missing or
empty, no check is performed (matching PHP's `empty()` semantics). Match the failure with
`isInvalidStateError(error)`. A missing/invalid OAuth config throws
`OAuthConfigValidationError` (`isOAuthConfigValidationError`); you can validate up
front with `validateOAuthConfig(oauth)`.

## Helpers

`accessTokenAuth({ accessToken, refreshToken?, expiresAt? })` builds an
authenticator by hand. `serializeAuth`/`deserializeAuth` round-trip it through a
string. `hasExpired`, `hasNotExpired`, `isRefreshable`, and `getExpiresAt` read
its state.

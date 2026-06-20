# Slice 7 — OAuth2 & DTOs

> **API style:** functional, no classes — see `api-style.md`. OAuth is **config +
> free functions**, not a trait/mixin. Refreshing token state lives in an injected
> **token store** (`tokens: { load, save }` on `defineConnector`) — the functional
> answer to "the class instance held the token". Worked reference:
> `examples/github-api/functional.ts`.

## Goal
Feature-parity capstone: OAuth2 Authorization Code + Client Credentials grants,
plus the DTO casting hook fully wired through `Response`. Tested via the Slice-6
mock client (no live OAuth provider needed).

## Example (consumer API)
```ts
import {
  defineConnector, defineRequest, send, Method,
  authorizationUrl, exchangeCode, refreshAccessToken,
  serializeAuth, deserializeAuth, hasExpired, isRefreshable,
  withAuth, type OAuthConfig, type OAuthAuthenticator,
} from 'saloon-js';

const oauth: OAuthConfig = {
  clientId: process.env.CLIENT_ID ?? '',
  clientSecret: process.env.CLIENT_SECRET ?? '',
  redirectUri: 'https://app.example.com/callback',
  defaultScopes: ['user:read'],
};
const api = defineConnector({ baseUrl: 'https://api.example.com', oauth });

// 1) Redirect the user; stash the returned CSRF state.
const { url, state } = authorizationUrl(api, { scopes: ['user:read'] });

// 2) On callback: exchange the code (state mismatch → InvalidStateError).
let auth: OAuthAuthenticator = await exchangeCode(api, 'code', { expectedState: state });
const persisted = serializeAuth(auth);   // store it yourself

// 3) Later: refresh if needed and thread it in (Answer A — explicit).
auth = deserializeAuth(persisted);
if (hasExpired(auth) && isRefreshable(auth)) auth = await refreshAccessToken(api, auth);

// DTOs: typed request → typed Response.
const getMe = () => defineRequest<{ id: string; email: string }>({
  method: Method.GET, endpoint: '/me', dto: (r) => r.json(),
});
const me = await send(api, withAuth(getMe(), auth));
me.dto().email;        // string
me.dtoOrFail().id;     // throws if the response failed

// Answer B — inject a token store; send() auto-loads/refreshes/saves.
const auto = defineConnector({
  baseUrl: 'https://api.example.com',
  oauth,
  tokens: {
    load: () => (persisted ? deserializeAuth(persisted) : null),
    save: (a) => { /* persist serializeAuth(a) */ },
  },
});
await send(auto, getMe());   // no manual threading
```

## Files (`src/oauth2/`)

### `oauthConfig.ts`
Port of `OAuthConfig.php` as a **plain object type** (no fluent builder). Passed as
`oauth` on `defineConnector`. Fields: `clientId`, `clientSecret`, `redirectUri`,
`authorizeEndpoint?` (default `authorize`), `tokenEndpoint?` (`token`),
`userEndpoint?` (`user`), `defaultScopes?: string[]`, `scopeSeparator?` (`' '`),
`allowBaseUrlOverride?` (**security**: false default — prevents SSRF via an
overridden token endpoint), `requestModifier?(request)`.
- `validateOAuthConfig(config, { withRedirectUrl = true }): void` — free function;
  throws `OAuthConfigValidationError` on missing required fields.

### Token store (`tokens` on `ConnectorConfig`)
`TokenStore = { load(): OAuthAuthenticator | null | Promise<…>; save(auth): void | Promise<void> }`.
When present, `send` (before dispatch) loads the authenticator, refreshes if
`hasExpired() && isRefreshable()`, applies it, and `save`s any refresh. When
absent, the caller threads the authenticator via `withAuth`/`options.auth`.

### Internal request factories (built with `defineRequest`, not classes)
- `getAccessTokenRequest(config, code)` — POST token endpoint,
  `formBody({ grant_type: 'authorization_code', code, redirect_uri, client_id, client_secret })`
- `getRefreshTokenRequest(config, refreshToken)` — `{ grant_type: 'refresh_token', … }`
- `getClientCredentialsTokenRequest(config, scopes)` — `{ grant_type: 'client_credentials', … }`
- `getClientCredentialsTokenBasicAuthRequest(...)` — same but id/secret via `basicAuth`
- `getOAuthUserRequest(config)` — GET user endpoint with bearer token

### `accessTokenAuthenticator.ts`
- `accessTokenAuth({ accessToken, refreshToken?, expiresAt?: Date }): OAuthAuthenticator`
  — factory returning an `Authenticator` whose `set(pending)` adds the bearer header.
- helper **functions** (not methods): `hasExpired(auth)`, `isRefreshable(auth)`,
  `getExpiresAt(auth)`, `serializeAuth(auth): string`, `deserializeAuth(json): OAuthAuthenticator`.

### Grant functions (`authorizationCodeGrant.ts`, `clientCredentialsGrant.ts`)
Free functions over a connector carrying `oauth` config:
- `authorizationUrl(connector, { scopes?, state?, scopeSeparator?, additionalQuery? }): { url, state }`
  — `response_type=code`, client_id, redirect_uri, state (auto-gen 32 chars via
  `crypto.getRandomValues`/`randomBytes` if absent), scopes. Returns state for the
  caller to stash (no instance to hold it).
- `exchangeCode(connector, code, { state?, expectedState?, requestModifier? }): Promise<OAuthAuthenticator>`
  — validate state (throw `InvalidStateError` on mismatch), send
  `getAccessTokenRequest`. `{ returnResponse: true }` → raw `Response` instead.
- `refreshAccessToken(connector, authOrToken, opts?): Promise<OAuthAuthenticator>`
- `getOAuthUser(connector, auth, requestModifier?): Promise<Response>`
- `clientCredentials(connector, { scopes?, basicAuth? }): Promise<OAuthAuthenticator>`

### Errors `src/errors/oauth/`
`OAuthConfigValidationError`, `InvalidStateError` (extend `SaloonError`); predicates
`isOAuthConfigValidationError`, `isInvalidStateError` (Slice-3 carve-out applies).

## DTOs (added here — first used now)
- Add the `RequestConfig<TDto>.dto(response)` hook + connector-level fallback
  `ConnectorConfig.dto` to the config/normalized types.
- Add `Response<TDto>.dto()` (returns `request.dto?.(this) ?? connector.dto?.(this)`)
  and `dtoOrFail()` (throws/rejects if `failed()`) to the response factory. These
  did not exist before this slice.
- Generic flow: `send(connector, getOAuthUserRequest(cfg))` → `Response<User>`;
  `response.dto()` → `User`.

## Tests (`tests/oauth2/`, via mock client)
- `authorizationCode.test.ts`: `authorizationUrl` params + returned state;
  `exchangeCode` posts correct form, returns authenticator w/ tokens/expiry; state
  mismatch → `InvalidStateError`/`isInvalidStateError`; `refreshAccessToken` works
  with token string or authenticator; `getOAuthUser` sends bearer.
- `tokenStore.test.ts`: connector with `tokens` auto-refreshes an expired
  authenticator on `send` and calls `save` with the fresh token; no refresh when
  unexpired.
- `clientCredentials.test.ts`: token + basic-auth variants post correct body/headers.
- `oauthConfig.test.ts`: `validateOAuthConfig` throws on missing fields;
  `allowBaseUrlOverride=false` blocks override.
- `authenticator.test.ts`: `serializeAuth`/`deserializeAuth` round-trip; `hasExpired`.
- `dto.test.ts`: typed dto returned; `dtoOrFail` throws on failed response.

## Done criteria
- Both grants work end-to-end via mock client with correct request shapes.
- Token-store auto-refresh works; manual `refreshAccessToken` threading works.
- State CSRF protection enforced; SSRF guard respected.
- DTO generics flow request → typed `Response`.
- typecheck + lint + build clean.

## Reference
- `../saloon/src/Traits/OAuth2/*.php`, `../saloon/src/Helpers/OAuth2/OAuthConfig.php`
- `../saloon/src/Http/OAuth2/*.php`, `../saloon/src/Http/Auth/AccessTokenAuthenticator.php`
- `../saloon/src/Traits/Responses/CreatesDtoFromResponse.php`

# Phase 7 — OAuth2 & DTOs

> **API style:** functional, no classes — see `api-style.md`. OAuth is **config +
> free functions**, not a trait/mixin. Refreshing token state lives in an
> injected **token store** (`tokens: { load, save }` on `defineConnector`) — the
> functional answer to "the class instance held the token". The worked reference
> is `examples/github-api/functional.ts` (both the threaded and store flows).

## Goal
Feature parity capstone: OAuth2 Authorization Code + Client Credentials grants, plus the DTO casting hook fully wired through Response.

## Files (`src/oauth2/`)

### `oauthConfig.ts`
Port of `../saloon/src/Helpers/OAuth2/OAuthConfig.php` as a **plain object type** (no fluent builder). Passed as `oauth` on `defineConnector`. `OAuthConfig`:
- `clientId`, `clientSecret`, `redirectUri`
- `authorizeEndpoint?` (default `authorize`), `tokenEndpoint?` (`token`), `userEndpoint?` (`user`)
- `defaultScopes?: string[]`, `scopeSeparator?` (`' '`)
- `allowBaseUrlOverride?: boolean` — **security**: false (default) prevents SSRF via an overridden token endpoint
- `requestModifier?: (request) => Request`
- `validateOAuthConfig(config, { withRedirectUrl = true }): void` — free function; throws `OAuthConfigValidationError` if required fields missing.

### Token store (`tokens` on `ConnectorConfig`)
`TokenStore = { load(): OAuthAuthenticator | null | Promise<…>; save(auth): void | Promise<void> }`. When present, `send` (before dispatch) loads the current authenticator, refreshes it if `hasExpired() && isRefreshable()`, applies it, and `save`s any refreshed token. When absent, the caller threads the authenticator manually via `withAuth`/`options.auth`.

### Internal request factories (`defineRequest`)
Built with `defineRequest`, not classes:
- `getAccessTokenRequest(config, code)` — POST token endpoint, `formBody({ grant_type: 'authorization_code', code, redirect_uri, client_id, client_secret })`
- `getRefreshTokenRequest(config, refreshToken)` — `{ grant_type: 'refresh_token', ... }`
- `getClientCredentialsTokenRequest(config, scopes)` — `{ grant_type: 'client_credentials', ... }`
- `getClientCredentialsTokenBasicAuthRequest(...)` — same but client id/secret via `basicAuth`
- `getOAuthUserRequest(config)` — GET user endpoint with bearer token

### `accessTokenAuthenticator.ts`
- `accessTokenAuth({ accessToken, refreshToken?, expiresAt?: Date }): OAuthAuthenticator` — factory returning an `Authenticator` whose `set(pending)` adds the bearer header.
- helper functions (not methods): `hasExpired(auth)`, `isRefreshable(auth)`, `getExpiresAt(auth)`, `serializeAuth(auth): string`, `deserializeAuth(json): OAuthAuthenticator` — so apps can persist tokens.

### Grant functions (`authorizationCodeGrant.ts`, `clientCredentialsGrant.ts`)
Free functions over a connector that carries `oauth` config (no mixin/trait):
- `authorizationUrl(connector, { scopes?, state?, scopeSeparator?, additionalQuery? }): { url: string; state: string }` — builds authorize URL with `response_type=code`, client_id, redirect_uri, state (auto-gen 32 chars via `crypto.getRandomValues`/`crypto.randomBytes` if absent), scopes. Returns the state for the caller to stash (no instance to hold it).
- `exchangeCode(connector, code, { state?, expectedState?, requestModifier? }): Promise<OAuthAuthenticator>` — validate state (throw `InvalidStateError` on mismatch), send `getAccessTokenRequest`. Pass `{ returnResponse: true }` to get the raw `Response` instead.
- `refreshAccessToken(connector, authOrToken, opts?): Promise<OAuthAuthenticator>`
- `getOAuthUser(connector, auth, requestModifier?): Promise<Response>`
- Client credentials: `clientCredentials(connector, { scopes?, basicAuth? }): Promise<OAuthAuthenticator>`.

### Errors
`OAuthConfigValidationError`, `InvalidStateError` under `src/errors/oauth/` (extend `SaloonError`); with `isOAuthConfigValidationError` / `isInvalidStateError` predicates (Phase 2 carve-out applies).

## DTOs (wire-through, mostly done in Phase 4)
- Confirm `RequestConfig<TDto>.dto(response)` hook + connector-level fallback (`ConnectorConfig.dto`).
- `Response<TDto>.dto()` returns `request.dto?.(this) ?? connector.dto?.(this)`; `dtoOrFail()` throws (or rejects) if `failed()`.
- Generic flow: `send(connector, getOAuthUserRequest(cfg))` → `Response<User>`; `response.dto()` → `User`.

## Tests (`tests/oauth2/`)
- `authorizationCode.test.ts` (via mock client): `authorizationUrl` contains correct params + returns state; `exchangeCode` posts correct form, returns authenticator with tokens/expiry; state mismatch throws `InvalidStateError` / `isInvalidStateError`; `refreshAccessToken` works with token string or authenticator; `getOAuthUser` sends bearer.
- `tokenStore.test.ts`: a connector with `tokens` auto-refreshes an expired authenticator on `send` and calls `save` with the fresh token; no refresh when unexpired.
- `clientCredentials.test.ts`: token + basic-auth variants post correct body/headers.
- `oauthConfig.test.ts`: `validateOAuthConfig` throws on missing fields; `allowBaseUrlOverride=false` blocks override.
- `authenticator.test.ts`: `serializeAuth`/`deserializeAuth` round-trip; `hasExpired`.
- `dto.test.ts`: typed dto returned; `dtoOrFail` throws on failed response.

## Done criteria
- Both grants work end-to-end via mock client with correct request shapes.
- Token-store auto-refresh works; manual `refreshAccessToken` threading works.
- State CSRF protection enforced; SSRF guard respected.
- DTO generics flow from request → typed Response.

## Reference
- `../saloon/src/Traits/OAuth2/{AuthorizationCodeGrant,ClientCredentialsGrant,ClientCredentialsBasicAuthGrant,HasOAuthConfig}.php`
- `../saloon/src/Helpers/OAuth2/OAuthConfig.php`
- `../saloon/src/Http/OAuth2/*.php`
- `../saloon/src/Http/Auth/AccessTokenAuthenticator.php`
- `../saloon/src/Traits/Responses/CreatesDtoFromResponse.php`

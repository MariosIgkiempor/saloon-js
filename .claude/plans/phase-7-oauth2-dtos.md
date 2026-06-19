# Phase 7 — OAuth2 & DTOs

## Goal
Feature parity capstone: OAuth2 Authorization Code + Client Credentials grants on connectors, plus the DTO casting hooks fully wired through Response.

## Files (`src/oauth2/`)

### `OAuthConfig.ts`
Port of `../saloon/src/Helpers/OAuth2/OAuthConfig.php`. Fluent builder + getters:
- `setClientId/setClientSecret/setRedirectUri`
- `setAuthorizeEndpoint` (default `authorize`), `setTokenEndpoint` (`token`), `setUserEndpoint` (`user`)
- `setDefaultScopes(string[])`, `setScopeSeparator(' ')`
- `setAllowBaseUrlOverride(bool)` — **security**: false prevents SSRF via overridden token endpoint
- `setRequestModifier(fn)`
- `validate(withRedirectUrl = true)` — throw `OAuthConfigValidationException` if required fields missing
- getters for all of the above.

### Internal request classes (extend `Request`)
- `GetAccessTokenRequest.ts` — POST token endpoint, form body `{ grant_type: 'authorization_code', code, redirect_uri, client_id, client_secret }`
- `GetRefreshTokenRequest.ts` — `{ grant_type: 'refresh_token', refresh_token, client_id, client_secret }`
- `GetClientCredentialsTokenRequest.ts` — `{ grant_type: 'client_credentials', client_id, client_secret, scope }`
- `GetClientCredentialsTokenBasicAuthRequest.ts` — same but client id/secret via Basic auth header
- `GetUserRequest.ts` — GET user endpoint with bearer token

### `AccessTokenAuthenticator.ts`
Implements `Authenticator` + serializable. `{ accessToken, refreshToken?, expiresAt?: Date }`. `set(pending)` → bearer header. `isNotRefreshable()`, `hasExpired()`, `getExpiresAt()`. Provide `serialize()`/`static unserialize()` (JSON) so apps can persist tokens.

### Grant composables on Connector (`authorizationCodeGrant.ts`, `clientCredentialsGrant.ts`)
Since TS has no traits, expose these as **mixins** (`AuthorizationCodeGrant(Base)` returning a subclass) AND/OR as a helper object a connector delegates to. Recommend a small mixin factory so a connector does `class X extends AuthorizationCodeGrant(Connector) { oauthConfig() {...} }`. Methods:
- `getAuthorizationUrl(scopes?, state?, scopeSeparator?, additionalQuery?)` — builds authorize URL with `response_type=code`, client_id, redirect_uri, state (auto-gen 32 chars via `crypto.getRandomValues`/`crypto.randomBytes` if absent), scopes; stash state.
- `getAccessToken(code, state?, expectedState?, returnResponse?, requestModifier?)` — validate state (throw `InvalidStateException` on mismatch), send `GetAccessTokenRequest`, return `AccessTokenAuthenticator` (or raw Response).
- `refreshAccessToken(authOrToken, returnResponse?, requestModifier?)`
- `getUser(authenticator, requestModifier?)`
- `getState()`
- Client credentials variant: `getAccessToken(scopes?, returnResponse?, requestModifier?)`.
- `oauthConfig()` lazy getter; `defaultOauthConfig()` override hook.

### Exceptions
`OAuthConfigValidationException`, `InvalidStateException` under `src/exceptions/oauth/` (extend `SaloonException`).

## DTOs (wire-through, mostly done in Phase 4)
- Confirm `Request<TDto>.createDtoFromResponse(response)` hook + connector-level fallback.
- `Response<TDto>.dto()` returns `request.createDtoFromResponse(this) ?? connector.createDtoFromResponse?.(this)`; `dtoOrFail()` throws (or rejects) if `failed()`.
- Generic flow: `connector.send(new GetUserRequest())` → `Response<User>`; `response.dto()` → `User | undefined`.

## Tests (`tests/oauth2/`)
- `authorizationCode.test.ts` (via MockClient): `getAuthorizationUrl` contains correct params + state; `getAccessToken` posts correct form, returns authenticator with tokens/expiry; state mismatch throws `InvalidStateException`; `refreshAccessToken` works with token string or authenticator; `getUser` sends bearer.
- `clientCredentials.test.ts`: token + basic-auth variants post correct body/headers.
- `oauthConfig.test.ts`: `validate()` throws on missing fields; `allowBaseUrlOverride=false` blocks override.
- `authenticator.test.ts`: serialize/unserialize round-trip; `hasExpired`.
- `dto.test.ts`: typed dto returned; `dtoOrFail` throws on failed response.

## Done criteria
- Both grants work end-to-end via MockClient with correct request shapes.
- State CSRF protection enforced; SSRF guard respected.
- DTO generics flow from request → typed Response.

## Reference
- `../saloon/src/Traits/OAuth2/{AuthorizationCodeGrant,ClientCredentialsGrant,ClientCredentialsBasicAuthGrant,HasOAuthConfig}.php`
- `../saloon/src/Helpers/OAuth2/OAuthConfig.php`
- `../saloon/src/Http/OAuth2/*.php`
- `../saloon/src/Http/Auth/AccessTokenAuthenticator.php`
- `../saloon/src/Traits/Responses/CreatesDtoFromResponse.php`

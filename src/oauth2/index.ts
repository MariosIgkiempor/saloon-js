// Public OAuth2 surface (re-exported from the package barrel in `src/index.ts`).

export {
  type AccessTokenAuthInput,
  accessTokenAuth,
  authenticatorFromResponse,
  deserializeAuth,
  getExpiresAt,
  hasExpired,
  hasNotExpired,
  isRefreshable,
  type OAuthAuthenticator,
  serializeAuth,
} from '@/oauth2/accessTokenAuthenticator';
export {
  type AuthorizationUrlOptions,
  authorizationUrl,
  type ExchangeCodeOptions,
  exchangeCode,
  getOAuthUser,
  type RefreshOptions,
  refreshAccessToken,
} from '@/oauth2/authorizationCodeGrant';
export {
  type ClientCredentialsOptions,
  clientCredentials,
} from '@/oauth2/clientCredentialsGrant';
export {
  type OAuthConfig,
  type OAuthRequestModifier,
  type ResolvedOAuthConfig,
  resolveOAuthConfig,
  validateOAuthConfig,
} from '@/oauth2/oauthConfig';
export { resolveTokenStoreAuth, type TokenStore } from '@/oauth2/tokenStore';

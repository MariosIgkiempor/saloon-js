// Port of SaloonPHP's AuthorizationCodeGrant trait (Traits/OAuth2/AuthorizationCodeGrant.php).
//
// Free functions over a connector carrying `oauth` config — no instance to hold
// the CSRF state, so `authorizationUrl` returns it for the caller to stash and
// `exchangeCode` takes it back. All internal sends pass `{ skipTokenStore: true }`
// so a token-store connector never recurses into itself while fetching a token.

import type { Connector } from '@/contracts/Connector';
import type { Response } from '@/contracts/Response';
import { InvalidStateError } from '@/errors/oauth/InvalidStateError';
import { OAuthConfigValidationError } from '@/errors/oauth/OAuthConfigValidationError';
import { joinUrl } from '@/helpers/urlHelper';
import { send } from '@/http/send';
import { withAuth } from '@/http/transformers';
import {
  authenticatorFromResponse,
  type OAuthAuthenticator,
} from '@/oauth2/accessTokenAuthenticator';
import {
  type OAuthRequestModifier,
  requireOAuthConfig,
  validateOAuthConfig,
} from '@/oauth2/oauthConfig';
import {
  getAccessTokenRequest,
  getOAuthUserRequest,
  getRefreshTokenRequest,
} from '@/oauth2/requests';

export interface AuthorizationUrlOptions {
  scopes?: string[];
  /** Provide your own CSRF state; one is generated when omitted. */
  state?: string;
  scopeSeparator?: string;
  additionalQuery?: Record<string, string | number | boolean>;
}

export interface ExchangeCodeOptions {
  /** The `state` returned on the OAuth callback. */
  state?: string;
  /** The `state` you stashed from `authorizationUrl` — must match `state`. */
  expectedState?: string;
  requestModifier?: OAuthRequestModifier;
  /** Resolve to the raw `Response` instead of an authenticator. */
  returnResponse?: boolean;
}

export interface RefreshOptions {
  requestModifier?: OAuthRequestModifier;
  returnResponse?: boolean;
}

function resolveBaseUrl(connector: Connector): string {
  return typeof connector.baseUrl === 'function' ? connector.baseUrl(connector) : connector.baseUrl;
}

/** 32 hex characters from the platform CSPRNG (PHP used a random 32-char string). */
function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * PHP `validateState`: throw only when **both** the returned state and the
 * expected state are non-empty and differ (`! empty($state) && ! empty($expectedState)
 * && $state !== $expectedState`). If either is missing/empty, PHP does not throw.
 */
function validateState(state?: string, expectedState?: string): void {
  if (state && expectedState && state !== expectedState) {
    throw new InvalidStateError('OAuth2 state does not match the expected state (possible CSRF).');
  }
}

/**
 * Build the provider authorization URL to redirect the user to. Returns the URL
 * plus the `state` (generated if not supplied) for the caller to stash and later
 * hand to `exchangeCode` as `expectedState`.
 */
export function authorizationUrl(
  connector: Connector,
  options: AuthorizationUrlOptions = {},
): { url: string; state: string } {
  const config = requireOAuthConfig(connector);
  // The auth URL needs client_id + redirect_uri; reuse the config validator.
  if (connector.oauth) validateOAuthConfig(connector.oauth);

  const state = options.state ?? generateState();
  const separator = options.scopeSeparator ?? config.scopeSeparator;
  const scopes = [...config.defaultScopes, ...(options.scopes ?? [])];

  const url = new URL(joinUrl(resolveBaseUrl(connector), config.authorizeEndpoint));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  if (config.redirectUri) url.searchParams.set('redirect_uri', config.redirectUri);
  if (scopes.length > 0) url.searchParams.set('scope', scopes.join(separator));
  url.searchParams.set('state', state);
  for (const [key, value] of Object.entries(options.additionalQuery ?? {})) {
    url.searchParams.set(key, String(value));
  }

  return { url: url.toString(), state };
}

export function exchangeCode(
  connector: Connector,
  code: string,
  options?: ExchangeCodeOptions & { returnResponse?: false },
): Promise<OAuthAuthenticator>;
export function exchangeCode(
  connector: Connector,
  code: string,
  options: ExchangeCodeOptions & { returnResponse: true },
): Promise<Response>;
export async function exchangeCode(
  connector: Connector,
  code: string,
  options: ExchangeCodeOptions = {},
): Promise<OAuthAuthenticator | Response> {
  const config = requireOAuthConfig(connector);
  validateState(options.state, options.expectedState);

  let request = getAccessTokenRequest(config, code);
  if (options.requestModifier) request = options.requestModifier(request);

  const response = await send(connector, request, { skipTokenStore: true });
  return options.returnResponse ? response : authenticatorFromResponse(response);
}

export function refreshAccessToken(
  connector: Connector,
  authOrToken: OAuthAuthenticator | string,
  options?: RefreshOptions & { returnResponse?: false },
): Promise<OAuthAuthenticator>;
export function refreshAccessToken(
  connector: Connector,
  authOrToken: OAuthAuthenticator | string,
  options: RefreshOptions & { returnResponse: true },
): Promise<Response>;
export async function refreshAccessToken(
  connector: Connector,
  authOrToken: OAuthAuthenticator | string,
  options: RefreshOptions = {},
): Promise<OAuthAuthenticator | Response> {
  const config = requireOAuthConfig(connector);
  const refreshToken = typeof authOrToken === 'string' ? authOrToken : authOrToken.refreshToken;
  if (!refreshToken) {
    throw new OAuthConfigValidationError('Cannot refresh: the authenticator has no refresh token.');
  }

  let request = getRefreshTokenRequest(config, refreshToken);
  if (options.requestModifier) request = options.requestModifier(request);

  const response = await send(connector, request, { skipTokenStore: true });
  // Reuse the old refresh token when the response omits a fresh one.
  return options.returnResponse ? response : authenticatorFromResponse(response, refreshToken);
}

/** Fetch the authenticated user from the provider user endpoint, with the bearer token applied. */
export async function getOAuthUser(
  connector: Connector,
  auth: OAuthAuthenticator,
  requestModifier?: OAuthRequestModifier,
): Promise<Response> {
  const config = requireOAuthConfig(connector);
  let request = withAuth(getOAuthUserRequest(config), auth);
  if (requestModifier) request = requestModifier(request);
  return send(connector, request, { skipTokenStore: true });
}

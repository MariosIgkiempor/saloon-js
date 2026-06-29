// Port of SaloonPHP's AccessTokenAuthenticator (Http/Auth/AccessTokenAuthenticator.php).
//
// An `OAuthAuthenticator` is an ordinary `Authenticator` (adds a bearer header)
// that also carries the token data the grant functions need to refresh it. PHP
// kept this state on the authenticator object and exposed methods (`hasExpired`,
// `isRefreshable`, …); the functional port keeps the data on a plain value and
// exposes free helper functions instead.

import type { Authenticator } from '@/contracts/Authenticator';
import type { Response } from '@/contracts/Response';
import type { PendingRequest } from '@/http/pendingRequest';
import { isOk } from '@/result';

export interface OAuthAuthenticator extends Authenticator {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: Date;
}

export interface AccessTokenAuthInput {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/** Build an `OAuthAuthenticator` that adds `Authorization: Bearer <accessToken>`. */
export function accessTokenAuth(input: AccessTokenAuthInput): OAuthAuthenticator {
  const { accessToken, refreshToken, expiresAt } = input;
  return {
    accessToken,
    refreshToken,
    expiresAt,
    set(pending: PendingRequest): void {
      pending.headers.add('Authorization', `Bearer ${accessToken}`);
    },
  };
}

export function getExpiresAt(auth: OAuthAuthenticator): Date | undefined {
  return auth.expiresAt;
}

/** True only when an `expiresAt` is set and lies in the past (PHP `hasExpired`). */
export function hasExpired(auth: OAuthAuthenticator): boolean {
  // PHP uses `<=`: a token expiring exactly now counts as expired.
  return auth.expiresAt instanceof Date && auth.expiresAt.getTime() <= Date.now();
}

export function hasNotExpired(auth: OAuthAuthenticator): boolean {
  return !hasExpired(auth);
}

/** True when a (non-empty) refresh token is present (PHP `isRefreshable`). */
export function isRefreshable(auth: OAuthAuthenticator): boolean {
  return typeof auth.refreshToken === 'string' && auth.refreshToken !== '';
}

interface SerializedAuth {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

/** Serialize to JSON for the caller to persist (PHP used `serialize()`). */
export function serializeAuth(auth: OAuthAuthenticator): string {
  const data: SerializedAuth = {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    expiresAt: auth.expiresAt?.toISOString(),
  };
  return JSON.stringify(data);
}

/** Reconstruct an `OAuthAuthenticator` from `serializeAuth` output. */
export function deserializeAuth(json: string): OAuthAuthenticator {
  const data = JSON.parse(json) as SerializedAuth;
  return accessTokenAuth({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
  });
}

/** Shape of a standard OAuth2 token endpoint response body. */
interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * Build an authenticator from a token endpoint `Response`. `expires_in` (seconds)
 * is turned into an absolute `expiresAt`; a missing `refresh_token` falls back to
 * `fallbackRefreshToken` (refresh responses often omit it, reusing the old one).
 */
export function authenticatorFromResponse(
  response: Response,
  fallbackRefreshToken?: string,
): OAuthAuthenticator {
  const parsed = response.json<OAuthTokenResponse>();
  const data = isOk(parsed) ? parsed.value : ({} as OAuthTokenResponse);
  const expiresAt =
    typeof data.expires_in === 'number' ? new Date(Date.now() + data.expires_in * 1000) : undefined;
  return accessTokenAuth({
    accessToken: data.access_token ?? '',
    refreshToken: data.refresh_token ?? fallbackRefreshToken,
    expiresAt,
  });
}

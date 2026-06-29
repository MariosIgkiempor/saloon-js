// Port of SaloonPHP's OAuthConfig (Helpers/OAuth2/OAuthConfig.php) as a plain
// object type — no fluent builder. Passed as `oauth` on `defineConnector`, read
// by the grant functions. `resolveOAuthConfig` applies the same defaults the PHP
// builder did; `validateOAuthConfig` mirrors `OAuthConfig::validate`.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import { OAuthConfigValidationError } from '@/errors/oauth/OAuthConfigValidationError';

/** A modifier applied to each internal OAuth request before it is sent. */
export type OAuthRequestModifier = (request: Request) => Request;

/** The OAuth2 config accepted on `defineConnector`. */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  /** Authorization endpoint, relative to the connector base URL (default `authorize`). */
  authorizeEndpoint?: string;
  /** Token endpoint (default `token`). */
  tokenEndpoint?: string;
  /** User endpoint hit by `getOAuthUser` (default `user`). */
  userEndpoint?: string;
  defaultScopes?: string[];
  /** Separator joining scopes in the query/body (default a single space). */
  scopeSeparator?: string;
  /**
   * Security: when false (the default) an absolute `tokenEndpoint`/`userEndpoint`
   * cannot override the connector base URL — closes an SSRF vector.
   */
  allowBaseUrlOverride?: boolean;
  /** Last-chance hook over each internal OAuth request (returns the new request). */
  requestModifier?: OAuthRequestModifier;
}

/** `OAuthConfig` with every optional field defaulted. */
export interface ResolvedOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  userEndpoint: string;
  defaultScopes: string[];
  scopeSeparator: string;
  allowBaseUrlOverride: boolean;
  requestModifier?: OAuthRequestModifier;
}

export function resolveOAuthConfig(config: OAuthConfig): ResolvedOAuthConfig {
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    authorizeEndpoint: config.authorizeEndpoint ?? 'authorize',
    tokenEndpoint: config.tokenEndpoint ?? 'token',
    userEndpoint: config.userEndpoint ?? 'user',
    defaultScopes: config.defaultScopes ?? [],
    scopeSeparator: config.scopeSeparator ?? ' ',
    allowBaseUrlOverride: config.allowBaseUrlOverride ?? false,
    requestModifier: config.requestModifier,
  };
}

/**
 * Throw `OAuthConfigValidationError` when required fields are missing. The
 * `redirectUri` is only required for the Authorization Code flow, so the Client
 * Credentials path passes `{ withRedirectUrl: false }`.
 */
export function validateOAuthConfig(
  config: OAuthConfig,
  { withRedirectUrl = true }: { withRedirectUrl?: boolean } = {},
): void {
  const missing: string[] = [];
  if (!config.clientId) missing.push('clientId');
  if (!config.clientSecret) missing.push('clientSecret');
  if (withRedirectUrl && !config.redirectUri) missing.push('redirectUri');

  if (missing.length > 0) {
    throw new OAuthConfigValidationError(`Invalid OAuth2 config: missing ${missing.join(', ')}.`);
  }
}

/** Read the resolved OAuth config off a connector, or throw if it has none. */
export function requireOAuthConfig(connector: Connector): ResolvedOAuthConfig {
  if (!connector.oauth) {
    throw new OAuthConfigValidationError(
      'This connector has no OAuth2 config; pass `oauth` to `defineConnector`.',
    );
  }
  return resolveOAuthConfig(connector.oauth);
}

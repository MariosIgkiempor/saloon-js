// Internal OAuth2 request factories — ports of SaloonPHP's
// Http/OAuth2/{GetAccessToken,GetRefreshToken,GetClientCredentialsToken,GetUser}Request.
//
// Built with `defineRequest` (not classes). Each posts to (or GETs) an endpoint
// relative to the connector base URL; `allowBaseUrlOverride` is taken from the
// config (false by default — the SSRF guard). A `requestModifier` on the config
// gets the last word over each request.

import { basicAuth } from '@/auth/basicAuth';
import type { Request } from '@/contracts/Request';
import { Method } from '@/enums';
import { defineRequest } from '@/http/defineRequest';
import type { ResolvedOAuthConfig } from '@/oauth2/oauthConfig';
import { formBody } from '@/repositories/body/formBody';

function applyModifier(config: ResolvedOAuthConfig, request: Request): Request {
  return config.requestModifier ? config.requestModifier(request) : request;
}

export function getAccessTokenRequest(config: ResolvedOAuthConfig, code: string): Request {
  return applyModifier(
    config,
    defineRequest({
      method: Method.POST,
      endpoint: config.tokenEndpoint,
      allowBaseUrlOverride: config.allowBaseUrlOverride,
      name: 'oauthAccessToken',
      body: formBody({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri ?? '',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    }),
  );
}

export function getRefreshTokenRequest(config: ResolvedOAuthConfig, refreshToken: string): Request {
  return applyModifier(
    config,
    defineRequest({
      method: Method.POST,
      endpoint: config.tokenEndpoint,
      allowBaseUrlOverride: config.allowBaseUrlOverride,
      name: 'oauthRefreshToken',
      body: formBody({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    }),
  );
}

export function getClientCredentialsTokenRequest(
  config: ResolvedOAuthConfig,
  scopes: string[],
): Request {
  const body = formBody({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  if (scopes.length > 0) body.merge({ scope: scopes.join(config.scopeSeparator) });

  return applyModifier(
    config,
    defineRequest({
      method: Method.POST,
      endpoint: config.tokenEndpoint,
      allowBaseUrlOverride: config.allowBaseUrlOverride,
      name: 'oauthClientCredentials',
      body,
    }),
  );
}

export function getClientCredentialsTokenBasicAuthRequest(
  config: ResolvedOAuthConfig,
  scopes: string[],
): Request {
  // Client id/secret travel in the Authorization header instead of the body.
  const body = formBody({ grant_type: 'client_credentials' });
  if (scopes.length > 0) body.merge({ scope: scopes.join(config.scopeSeparator) });

  return applyModifier(
    config,
    defineRequest({
      method: Method.POST,
      endpoint: config.tokenEndpoint,
      allowBaseUrlOverride: config.allowBaseUrlOverride,
      name: 'oauthClientCredentials',
      auth: basicAuth(config.clientId, config.clientSecret),
      body,
    }),
  );
}

export function getOAuthUserRequest(config: ResolvedOAuthConfig): Request {
  // The bearer token is threaded in by `getOAuthUser` via `withAuth`.
  return applyModifier(
    config,
    defineRequest({
      method: Method.GET,
      endpoint: config.userEndpoint,
      allowBaseUrlOverride: config.allowBaseUrlOverride,
      name: 'oauthUser',
    }),
  );
}

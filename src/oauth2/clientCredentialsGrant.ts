// Port of SaloonPHP's ClientCredentialsGrant trait (Traits/OAuth2/ClientCredentialsGrant.php).
//
// A single free function. `basicAuth: true` sends the client id/secret in the
// Authorization header instead of the form body. `redirectUri` is not required
// for this flow, so the config validator is told to skip it.

import type { Connector } from '@/contracts/Connector';
import type { Response } from '@/contracts/Response';
import { send } from '@/http/send';
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
  getClientCredentialsTokenBasicAuthRequest,
  getClientCredentialsTokenRequest,
} from '@/oauth2/requests';

export interface ClientCredentialsOptions {
  scopes?: string[];
  /** Send client id/secret via HTTP Basic auth instead of the body. */
  basicAuth?: boolean;
  requestModifier?: OAuthRequestModifier;
  returnResponse?: boolean;
}

export function clientCredentials(
  connector: Connector,
  options?: ClientCredentialsOptions & { returnResponse?: false },
): Promise<OAuthAuthenticator>;
export function clientCredentials(
  connector: Connector,
  options: ClientCredentialsOptions & { returnResponse: true },
): Promise<Response>;
export async function clientCredentials(
  connector: Connector,
  options: ClientCredentialsOptions = {},
): Promise<OAuthAuthenticator | Response> {
  const config = requireOAuthConfig(connector);
  if (connector.oauth) validateOAuthConfig(connector.oauth, { withRedirectUrl: false });

  const scopes = [...config.defaultScopes, ...(options.scopes ?? [])];
  let request = options.basicAuth
    ? getClientCredentialsTokenBasicAuthRequest(config, scopes)
    : getClientCredentialsTokenRequest(config, scopes);
  if (options.requestModifier) request = options.requestModifier(request);

  const response = await send(connector, request, { skipTokenStore: true });
  return options.returnResponse ? response : authenticatorFromResponse(response);
}

import { describe, expect, it } from 'vitest';
import { createMockClient } from '@/faking/mockClient';
import { mockResponse } from '@/faking/mockResponse';
import { toBase64 } from '@/helpers/base64';
import { defineConnector } from '@/http/defineConnector';
import { clientCredentials } from '@/oauth2/clientCredentialsGrant';

const connector = (mock: ReturnType<typeof createMockClient>) =>
  defineConnector({
    baseUrl: 'https://oauth.example.com',
    mockClient: mock,
    oauth: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      defaultScopes: ['read'],
    },
  });

const lastForm = (mock: ReturnType<typeof createMockClient>): Record<string, string> =>
  (mock.getLastPendingRequest()?.getBody()?.all() ?? {}) as Record<string, string>;

describe('clientCredentials', () => {
  it('posts grant_type + client id/secret in the body by default', async () => {
    const mock = createMockClient(
      new Map([
        ['oauthClientCredentials', mockResponse({ access_token: 'cc-token', expires_in: 3600 })],
      ]),
    );

    const auth = await clientCredentials(connector(mock), { scopes: ['write'] });

    expect(auth.accessToken).toBe('cc-token');
    const form = lastForm(mock);
    expect(form.grant_type).toBe('client_credentials');
    expect(form.client_id).toBe('client-id');
    expect(form.client_secret).toBe('client-secret');
    // Default scope merges ahead of the per-call one.
    expect(form.scope).toBe('read write');
  });

  it('sends id/secret via Basic auth (not the body) when basicAuth is set', async () => {
    const mock = createMockClient(
      new Map([['oauthClientCredentials', mockResponse({ access_token: 'cc-token' })]]),
    );

    await clientCredentials(connector(mock), { basicAuth: true });

    const pending = mock.getLastPendingRequest();
    expect(pending?.headers.get('Authorization')).toBe(
      `Basic ${toBase64('client-id:client-secret')}`,
    );
    const form = lastForm(mock);
    expect(form.grant_type).toBe('client_credentials');
    expect(form.client_id).toBeUndefined();
    expect(form.client_secret).toBeUndefined();
  });
});

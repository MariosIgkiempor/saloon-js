import { describe, expect, it } from 'vitest';
import { isInvalidStateError } from '@/errors';
import { createMockClient } from '@/faking/mockClient';
import { mockResponse } from '@/faking/mockResponse';
import { defineConnector } from '@/http/defineConnector';
import { accessTokenAuth } from '@/oauth2/accessTokenAuthenticator';
import {
  authorizationUrl,
  exchangeCode,
  getOAuthUser,
  refreshAccessToken,
} from '@/oauth2/authorizationCodeGrant';

const oauthConnector = (mock?: ReturnType<typeof createMockClient>) =>
  defineConnector({
    baseUrl: 'https://oauth.example.com',
    mockClient: mock,
    oauth: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/callback',
      defaultScopes: ['user:read'],
    },
  });

/** Read the form body posted by the last recorded request. */
const lastForm = (mock: ReturnType<typeof createMockClient>): Record<string, string> =>
  (mock.getLastPendingRequest()?.getBody()?.all() ?? {}) as Record<string, string>;

describe('authorizationUrl', () => {
  it('builds the provider URL with the expected params and returns the state', () => {
    const { url, state } = authorizationUrl(oauthConnector(), { scopes: ['repo'] });
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://oauth.example.com/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('client-id');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
    // Default scopes merge ahead of the per-call ones, joined by the default space.
    expect(parsed.searchParams.get('scope')).toBe('user:read repo');
    expect(parsed.searchParams.get('state')).toBe(state);
    expect(state).toHaveLength(32);
  });

  it('uses a caller-provided state verbatim', () => {
    const { state } = authorizationUrl(oauthConnector(), { state: 'fixed-state' });
    expect(state).toBe('fixed-state');
  });
});

describe('exchangeCode', () => {
  it('posts the authorization_code form and returns an authenticator', async () => {
    const mock = createMockClient(
      new Map([
        [
          'oauthAccessToken',
          mockResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
        ],
      ]),
    );

    const auth = await exchangeCode(oauthConnector(mock), 'the-code');

    expect(auth.accessToken).toBe('at');
    expect(auth.refreshToken).toBe('rt');
    expect(auth.expiresAt).toBeInstanceOf(Date);

    const form = lastForm(mock);
    expect(form.grant_type).toBe('authorization_code');
    expect(form.code).toBe('the-code');
    expect(form.redirect_uri).toBe('https://app.example.com/callback');
    expect(form.client_id).toBe('client-id');
    expect(form.client_secret).toBe('client-secret');
  });

  it('throws InvalidStateError when state and expectedState differ', async () => {
    const mock = createMockClient(new Map([['oauthAccessToken', mockResponse({})]]));
    try {
      await exchangeCode(oauthConnector(mock), 'code', { state: 'a', expectedState: 'b' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(isInvalidStateError(error)).toBe(true);
    }
  });

  it('passes when state matches expectedState', async () => {
    const mock = createMockClient(
      new Map([['oauthAccessToken', mockResponse({ access_token: 'ok' })]]),
    );
    const auth = await exchangeCode(oauthConnector(mock), 'code', {
      state: 'same',
      expectedState: 'same',
    });
    expect(auth.accessToken).toBe('ok');
  });
});

describe('refreshAccessToken', () => {
  it('refreshes from an authenticator and reuses the old refresh token when omitted', async () => {
    const mock = createMockClient(
      new Map([['oauthRefreshToken', mockResponse({ access_token: 'fresh', expires_in: 3600 })]]),
    );
    const connector = oauthConnector(mock);
    const stale = accessTokenAuth({ accessToken: 'old', refreshToken: 'old-refresh' });

    const refreshed = await refreshAccessToken(connector, stale);

    expect(refreshed.accessToken).toBe('fresh');
    expect(refreshed.refreshToken).toBe('old-refresh');
    expect(lastForm(mock).grant_type).toBe('refresh_token');
    expect(lastForm(mock).refresh_token).toBe('old-refresh');
  });

  it('refreshes from a bare token string', async () => {
    const mock = createMockClient(
      new Map([['oauthRefreshToken', mockResponse({ access_token: 'fresh' })]]),
    );
    const refreshed = await refreshAccessToken(oauthConnector(mock), 'rt-string');
    expect(refreshed.accessToken).toBe('fresh');
    expect(lastForm(mock).refresh_token).toBe('rt-string');
  });
});

describe('getOAuthUser', () => {
  it('sends a bearer Authorization header to the user endpoint', async () => {
    const mock = createMockClient(new Map([['oauthUser', mockResponse({ id: 'u1' })]]));
    const connector = oauthConnector(mock);
    const auth = accessTokenAuth({ accessToken: 'the-access-token' });

    const response = await getOAuthUser(connector, auth);

    expect(response.status()).toBe(200);
    expect(mock.getLastPendingRequest()?.headers.get('Authorization')).toBe(
      'Bearer the-access-token',
    );
    expect(mock.getLastPendingRequest()?.url).toBe('https://oauth.example.com/user');
  });
});

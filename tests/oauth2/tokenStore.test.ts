import { describe, expect, it, vi } from 'vitest';
import { Method } from '@/enums';
import { createMockClient } from '@/faking/mockClient';
import { mockResponse } from '@/faking/mockResponse';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { accessTokenAuth, type OAuthAuthenticator } from '@/oauth2/accessTokenAuthenticator';
import type { TokenStore } from '@/oauth2/tokenStore';

const getMe = defineRequest({ method: Method.GET, endpoint: '/me', name: 'getMe' });

const connectorWith = (mock: ReturnType<typeof createMockClient>, tokens: TokenStore) =>
  defineConnector({
    baseUrl: 'https://api.example.com',
    mockClient: mock,
    tokens,
    oauth: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://app.example.com/callback',
    },
  });

describe('token store auto-refresh', () => {
  it('refreshes an expired authenticator, saves it, and applies the fresh bearer', async () => {
    const expired = accessTokenAuth({
      accessToken: 'stale',
      refreshToken: 'r1',
      expiresAt: new Date(Date.now() - 1000),
    });
    const saved: OAuthAuthenticator[] = [];
    const tokens: TokenStore = {
      load: () => expired,
      save: (auth) => {
        saved.push(auth);
      },
    };

    const mock = createMockClient(
      new Map([
        ['oauthRefreshToken', mockResponse({ access_token: 'fresh', expires_in: 3600 })],
        ['getMe', mockResponse({ id: 'u1' })],
      ]),
    );

    await send(connectorWith(mock, tokens), getMe);

    // save() got the refreshed token.
    expect(saved).toHaveLength(1);
    expect(saved[0]?.accessToken).toBe('fresh');
    // The user request carried the fresh bearer (last recorded request is /me).
    expect(mock.getLastPendingRequest()?.headers.get('Authorization')).toBe('Bearer fresh');
    expect(mock.getLastPendingRequest()?.url).toBe('https://api.example.com/me');
  });

  it('does not refresh when the loaded authenticator is still valid', async () => {
    const save = vi.fn();
    const tokens: TokenStore = {
      load: () =>
        accessTokenAuth({
          accessToken: 'valid',
          refreshToken: 'r1',
          expiresAt: new Date(Date.now() + 60_000),
        }),
      save,
    };

    const mock = createMockClient(new Map([['getMe', mockResponse({ id: 'u1' })]]));

    await send(connectorWith(mock, tokens), getMe);

    expect(save).not.toHaveBeenCalled();
    mock.assertNotSent('oauthRefreshToken');
    expect(mock.getLastPendingRequest()?.headers.get('Authorization')).toBe('Bearer valid');
  });

  it('leaves an explicitly-threaded authenticator untouched', async () => {
    const load = vi.fn(() => null);
    const tokens: TokenStore = { load, save: vi.fn() };
    const mock = createMockClient(new Map([['getMe', mockResponse({ id: 'u1' })]]));

    await send(connectorWith(mock, tokens), getMe, {
      auth: accessTokenAuth({ accessToken: 'explicit' }),
    });

    expect(load).not.toHaveBeenCalled();
    expect(mock.getLastPendingRequest()?.headers.get('Authorization')).toBe('Bearer explicit');
  });
});

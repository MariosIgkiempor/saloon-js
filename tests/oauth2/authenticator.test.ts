import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accessTokenAuth,
  deserializeAuth,
  getExpiresAt,
  hasExpired,
  hasNotExpired,
  isRefreshable,
  serializeAuth,
} from '@/oauth2/accessTokenAuthenticator';

describe('accessTokenAuth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a bearer Authorization header', () => {
    const auth = accessTokenAuth({ accessToken: 'abc123' });
    const headers: Record<string, string> = {};
    // Minimal pending stub: only `headers.add` is exercised by `set`.
    auth.set({ headers: { add: (k: string, v: string) => (headers[k] = v) } } as never);
    expect(headers.Authorization).toBe('Bearer abc123');
  });

  it('round-trips through serialize/deserialize', () => {
    const expiresAt = new Date('2030-01-01T00:00:00.000Z');
    const auth = accessTokenAuth({ accessToken: 'a', refreshToken: 'r', expiresAt });

    const restored = deserializeAuth(serializeAuth(auth));

    expect(restored.accessToken).toBe('a');
    expect(restored.refreshToken).toBe('r');
    expect(getExpiresAt(restored)?.toISOString()).toBe(expiresAt.toISOString());
  });

  it('treats a past expiry as expired and a future one as not', () => {
    const past = accessTokenAuth({ accessToken: 'a', expiresAt: new Date(Date.now() - 1000) });
    const future = accessTokenAuth({ accessToken: 'a', expiresAt: new Date(Date.now() + 60_000) });

    expect(hasExpired(past)).toBe(true);
    expect(hasNotExpired(past)).toBe(false);
    expect(hasExpired(future)).toBe(false);
  });

  it('is never expired without an expiry', () => {
    expect(hasExpired(accessTokenAuth({ accessToken: 'a' }))).toBe(false);
  });

  it('treats an expiry exactly at now as expired (PHP uses <=)', () => {
    const instant = new Date('2030-06-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(instant);
    const auth = accessTokenAuth({ accessToken: 'a', expiresAt: instant });
    expect(hasExpired(auth)).toBe(true);
  });

  it('is refreshable only with a non-empty refresh token', () => {
    expect(isRefreshable(accessTokenAuth({ accessToken: 'a', refreshToken: 'r' }))).toBe(true);
    expect(isRefreshable(accessTokenAuth({ accessToken: 'a' }))).toBe(false);
    expect(isRefreshable(accessTokenAuth({ accessToken: 'a', refreshToken: '' }))).toBe(false);
  });
});

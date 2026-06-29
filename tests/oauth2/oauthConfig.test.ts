import { describe, expect, it } from 'vitest';
import { isOAuthConfigValidationError } from '@/errors';
import { resolveOAuthConfig, validateOAuthConfig } from '@/oauth2/oauthConfig';

const full = {
  clientId: 'id',
  clientSecret: 'secret',
  redirectUri: 'https://app.example.com/callback',
};

describe('validateOAuthConfig', () => {
  it('passes a complete config', () => {
    expect(() => validateOAuthConfig(full)).not.toThrow();
  });

  it('throws (and is predicate-matchable) when clientId is missing', () => {
    try {
      validateOAuthConfig({ ...full, clientId: '' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(isOAuthConfigValidationError(error)).toBe(true);
      expect((error as Error).message).toContain('clientId');
    }
  });

  it('requires a redirectUri by default', () => {
    expect(() => validateOAuthConfig({ clientId: 'id', clientSecret: 'secret' })).toThrow();
  });

  it('skips the redirectUri check when asked (client credentials)', () => {
    expect(() =>
      validateOAuthConfig({ clientId: 'id', clientSecret: 'secret' }, { withRedirectUrl: false }),
    ).not.toThrow();
  });
});

describe('resolveOAuthConfig', () => {
  it('applies the SaloonPHP endpoint/separator/SSRF defaults', () => {
    const resolved = resolveOAuthConfig(full);
    expect(resolved.authorizeEndpoint).toBe('authorize');
    expect(resolved.tokenEndpoint).toBe('token');
    expect(resolved.userEndpoint).toBe('user');
    expect(resolved.scopeSeparator).toBe(' ');
    expect(resolved.allowBaseUrlOverride).toBe(false);
    expect(resolved.defaultScopes).toEqual([]);
  });

  it('keeps explicit overrides', () => {
    const resolved = resolveOAuthConfig({
      ...full,
      tokenEndpoint: 'oauth/token',
      scopeSeparator: ',',
      allowBaseUrlOverride: true,
      defaultScopes: ['a', 'b'],
    });
    expect(resolved.tokenEndpoint).toBe('oauth/token');
    expect(resolved.scopeSeparator).toBe(',');
    expect(resolved.allowBaseUrlOverride).toBe(true);
    expect(resolved.defaultScopes).toEqual(['a', 'b']);
  });
});

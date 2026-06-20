// Port of ../saloon/src/Helpers/URLHelper.php

/**
 * Join a base URL and an endpoint into a single URL.
 *
 * - An absolute-URL endpoint replaces the base when `allowOverride` is set (or
 *   when there is no base URL).
 * - An empty endpoint (or a bare `/`) yields the base URL untouched.
 * - Otherwise the two are joined with exactly one `/` between them.
 */
export function joinUrl(baseUrl: string, endpoint: string, allowOverride = false): string {
  const ep = endpoint === '/' ? '' : endpoint;

  if (isValidUrl(ep) && (allowOverride || baseUrl === '')) {
    return ep;
  }

  // A query-only endpoint (`?foo=bar`) attaches directly, with no extra slash.
  const requiresTrailingSlash = ep !== '' && !ep.startsWith('?');
  const base = requiresTrailingSlash ? `${rtrim(baseUrl)}/` : baseUrl;

  return base + ltrim(ep);
}

/** Mirrors PHP `filter_var($value, FILTER_VALIDATE_URL)`: a parseable, schemed URL. */
export function isValidUrl(value: string): boolean {
  try {
    return Boolean(new URL(value).protocol);
  } catch {
    return false;
  }
}

const rtrim = (value: string): string => value.replace(/[/ ]+$/, '');
const ltrim = (value: string): string => value.replace(/^[/ ]+/, '');

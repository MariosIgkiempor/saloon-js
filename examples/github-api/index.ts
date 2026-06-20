/**
 * saloon-js — GitHub API example (functional API sketch).
 *
 * A hallucinated sketch of the saloon-js API, designed before the library
 * exists. No classes: a Connector and a Request are plain config produced by
 * factory functions (`defineConnector` / `defineRequest`); `send()` is a free
 * function instead of a method. The PHP `default*()` override points become
 * fields on the config object, and per-request tweaks happen via `withX`
 * transformers rather than subclassing. See `.claude/plans/api-style.md`.
 */

import {
  defineConnector,
  defineRequest,
  send,
  tokenAuth,
  Method,
  authorizationUrl,
  exchangeCode,
  refreshAccessToken,
  hasExpired,
  isRefreshable,
  serializeAuth,
  deserializeAuth,
  withAuth,
  type Response,
  type OAuthConfig,
  type OAuthAuthenticator,
} from 'saloon-js';

interface Repo {
  name: string;
  fullName: string;
  stars: number;
  url: string;
}

// ---------------------------------------------------------------------------
// Connector — a value, not a class. `defineConnector` just validates/normalizes
// the config and hands back a reusable object.
// ---------------------------------------------------------------------------

const gitHub = (token: string) =>
  defineConnector({
    baseUrl: 'https://api.github.com',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    auth: tokenAuth(token),
  });

// ---------------------------------------------------------------------------
// Request — a factory returning config. Generics on `defineRequest` thread the
// DTO type through to `response.dto()` without a class.
// ---------------------------------------------------------------------------

const listUserRepos = (
  username: string,
  options: { perPage?: number; sort?: 'created' | 'updated' | 'pushed' } = {},
) =>
  defineRequest<Repo[]>({
    method: Method.GET,
    endpoint: `/users/${username}/repos`,
    query: {
      per_page: options.perPage ?? 30,
      ...(options.sort ? { sort: options.sort } : {}),
    },
    dto: (response: Response): Repo[] =>
      response.json<Array<Record<string, unknown>>>().map((raw) => ({
        name: raw.name as string,
        fullName: raw.full_name as string,
        stars: raw.stargazers_count as number,
        url: raw.html_url as string,
      })),
  });

// ---------------------------------------------------------------------------
// Usage — `send(connector, request)` instead of `connector.send(request)`.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const connector = gitHub(process.env.GITHUB_TOKEN ?? '');

  const response = await send(connector, listUserRepos('saloonphp', { perPage: 5, sort: 'updated' }));

  if (response.failed()) {
    console.error(`Request failed: HTTP ${response.status()}`);
    return;
  }

  console.log(`HTTP ${response.status()}`);
  for (const repo of response.dto()) {
    console.log(`★ ${repo.stars.toString().padStart(6)}  ${repo.fullName}`);
  }
}

await main();

// ---------------------------------------------------------------------------
// Variant: a thin pipeline form, if we lean all the way into composition.
// Middleware are just functions; `pipe` composes them, and a curried `send`
// lets a configured connector be partially applied and reused.
//
//   const api = send.with(gitHub(token));
//   const repos = await api(listUserRepos('saloonphp')).then((r) => r.dto());
//
// Per-call overrides compose instead of subclass:
//
//   await api(withQuery(listUserRepos('saloonphp'), { type: 'owner' }));
//   await api(withHeaders(listUserRepos('saloonphp'), { 'If-None-Match': etag }));
//
// ...where `withQuery` / `withHeaders` are `(request, patch) => request`.

// ===========================================================================
// OAuth2 (authorization code grant).
//
// With no connector instance to hold the authenticator, the question "where
// does the refreshing token live?" has to be answered explicitly. Two answers:
// ===========================================================================

const spotifyConfig: OAuthConfig = {
  clientId: process.env.SPOTIFY_CLIENT_ID ?? '',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
  redirectUri: 'https://example.com/callback',
  authorizeEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
  defaultScopes: ['user-read-email'],
};

const getCurrentUser = () =>
  defineRequest<{ id: string; email: string }>({
    method: Method.GET,
    endpoint: '/me',
  });

declare const tokenStore: {
  load(): string | null;
  save(serialized: string): void;
};

// --- Answer A: pure threading. The authenticator is a value you own. ---
//
// Honest about state — there is none hidden. But the caller has to carry `auth`
// through every call and remember to persist the refreshed one. Forget to
// reassign and you keep using the stale token.
async function oauthThreaded(): Promise<void> {
  const spotify = defineConnector({ baseUrl: 'https://api.spotify.com/v1', oauth: spotifyConfig });

  const url = authorizationUrl(spotify, { scopes: ['user-read-email'], state: 'csrf-state' });
  console.log(`Send the user to: ${url}`);

  // After the redirect callback:
  let auth: OAuthAuthenticator = await exchangeCode(spotify, 'code-from-callback');
  tokenStore.save(serializeAuth(auth));

  // Later request:
  auth = deserializeAuth(tokenStore.load() ?? '');
  if (hasExpired(auth) && isRefreshable(auth)) {
    auth = await refreshAccessToken(spotify, auth); // NEW value — must reassign + persist
    tokenStore.save(serializeAuth(auth));
  }

  // Auth is threaded into the request explicitly, per call.
  const me = await send(spotify, withAuth(getCurrentUser(), auth));
  console.log(`Logged in as ${me.dto().email}`);
}

// --- Answer B: inject the store. State lives in the caller's store, passed in
// as two functions; the connector auto-refreshes on send(). ---
//
// This is the functional reply to "the class instance holds state": the
// impurity (load/save) is injected at the edge, the library core stays pure,
// and `send()` regains the no-ceremony ergonomics of the class version.
async function oauthWithStore(): Promise<void> {
  const spotify = defineConnector({
    baseUrl: 'https://api.spotify.com/v1',
    oauth: spotifyConfig,
    tokens: {
      load: () => {
        const raw = tokenStore.load();
        return raw ? deserializeAuth(raw) : null;
      },
      save: (auth: OAuthAuthenticator) => tokenStore.save(serializeAuth(auth)),
    },
  });

  // No threading: send() reads from `load`, refreshes if expired, writes via `save`.
  const me = await send(spotify, getCurrentUser());
  console.log(`Logged in as ${me.dto().email}`);
}

void oauthThreaded;
void oauthWithStore;

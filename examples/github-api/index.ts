/**
 * saloon-js — GitHub API example (the functional API, for real this time).
 *
 * No classes: a connector and a request are plain config produced by factory
 * functions (`defineConnector` / `defineRequest`); `send()` is a free function
 * instead of a method. PHP's `default*()` override points become fields on the
 * config object, and per-request tweaks happen via `withX` transformers rather
 * than subclassing. See `.claude/plans/api-style.md`.
 *
 * Everything here imports from the published barrel (`saloon-js`) and tracks the
 * real, shipped API — the same surface the README quickstart and the smoke test
 * (`tests/examples/githubApi.test.ts`) exercise.
 *
 *   pnpm install
 *   GITHUB_TOKEN=… pnpm start
 */

import {
  acceptsJson,
  defineConnector,
  defineRequest,
  isErr,
  isNotFoundError,
  Method,
  type Response,
  send,
  tokenAuth,
  withQuery,
} from 'saloon-js';

interface Repo {
  fullName: string;
  stars: number;
  url: string;
}

// ---------------------------------------------------------------------------
// Connector — a value, not a class. `defineConnector` normalizes the config and
// hands back a reusable object. `auth` and `plugins` are config fields, not
// traits or method overrides.
// ---------------------------------------------------------------------------

const gitHub = (token: string) =>
  defineConnector({
    baseUrl: 'https://api.github.com',
    auth: tokenAuth(token),
    plugins: [acceptsJson()],
    headers: { 'X-GitHub-Api-Version': '2022-11-28' },
  });

// ---------------------------------------------------------------------------
// Requests — factories returning config. The generic on `defineRequest` threads
// the DTO type through to `response.dto()` without a class. `dto` maps the wire
// shape into your domain type; `response.json(key)` reads a single field.
// ---------------------------------------------------------------------------

const getRepo = (owner: string, repo: string) =>
  defineRequest<Repo>({
    method: Method.GET,
    endpoint: `/repos/${owner}/${repo}`,
    dto: (r: Response): Repo => ({
      fullName: r.json<string>('full_name'),
      stars: r.json<number>('stargazers_count'),
      url: r.json<string>('html_url'),
    }),
  });

const listUserRepos = (username: string, perPage = 30) =>
  defineRequest<Repo[]>({
    method: Method.GET,
    endpoint: `/users/${username}/repos`,
    query: { per_page: perPage },
    // `json()` with no key returns a `Result` (it never throws on malformed
    // JSON); unwrap it explicitly before mapping the array.
    dto: (r: Response): Repo[] => {
      const body = r.json<Array<Record<string, unknown>>>();
      if (isErr(body)) return [];
      return body.value.map((raw) => ({
        fullName: raw.full_name as string,
        stars: raw.stargazers_count as number,
        url: raw.html_url as string,
      }));
    },
  });

// ---------------------------------------------------------------------------
// Usage — `send(connector, request)` instead of `connector.send(request)`.
// 4xx/5xx do not throw; obtain the failure as a value with `toResult()` and
// narrow it with an error predicate.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const connector = gitHub(process.env.GITHUB_TOKEN ?? '');

  const res = await send(connector, getRepo('saloonphp', 'saloon'));
  const result = res.toResult();
  if (isErr(result)) {
    if (isNotFoundError(result.error)) console.error('no such repo');
    else console.error(`request failed: HTTP ${res.status()}`);
    return;
  }

  const repo = res.dto();
  console.log(`★ ${repo.stars.toString().padStart(6)}  ${repo.fullName}`);

  // Per-call tweaks compose instead of subclassing: `withQuery` returns a new
  // request with the patch merged over the factory's defaults.
  const recent = await send(
    connector,
    withQuery(listUserRepos('saloonphp', 5), { sort: 'updated' }),
  );
  for (const r of recent.dto()) {
    console.log(`  ${r.stars.toString().padStart(6)}  ${r.fullName}`);
  }
}

await main();

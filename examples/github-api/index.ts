/**
 * saloon-js — GitHub API example.
 *
 * A connector and a request are plain config produced by `defineConnector` /
 * `defineRequest`; PHP's `default*()` override points become fields on the
 * config object, and per-request tweaks happen via `withX` transformers.
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
// Connector — `defineConnector` normalizes the config and hands back a reusable
// object. `auth` and `plugins` are config fields.
// ---------------------------------------------------------------------------

const gitHub = (token: string) =>
  defineConnector({
    baseUrl: 'https://api.github.com',
    auth: tokenAuth(token),
    plugins: [acceptsJson()],
    headers: { 'X-GitHub-Api-Version': '2022-11-28' },
  });

// ---------------------------------------------------------------------------
// Requests — factories returning config. `validator` both validates the response
// body and types it: `defineRequest` infers the response type from it, so
// `response.dto()` is typed without an explicit generic. A `validator` is either
// a function (it returns the typed value, or throws on invalid) or any Standard
// Schema (Zod/Valibot/ArkType — see docs/validation.md). `send` runs it
// automatically; an invalid body throws a `ValidationError`.
// ---------------------------------------------------------------------------

const getRepo = (owner: string, repo: string) =>
  defineRequest({
    method: Method.GET,
    endpoint: `/repos/${owner}/${repo}`,
    validator: (data): Repo => {
      const raw = data as Record<string, unknown>;
      return {
        fullName: raw.full_name as string,
        stars: raw.stargazers_count as number,
        url: raw.html_url as string,
      };
    },
  });

const listUserRepos = (username: string, perPage = 30) =>
  defineRequest({
    method: Method.GET,
    endpoint: `/users/${username}/repos`,
    query: { per_page: perPage },
    validator: (data): Repo[] => {
      if (!Array.isArray(data)) throw new Error('expected an array of repos');
      return data.map((raw: Record<string, unknown>) => ({
        fullName: raw.full_name as string,
        stars: raw.stargazers_count as number,
        url: raw.html_url as string,
      }));
    },
  });

// ---------------------------------------------------------------------------
// Usage. 4xx/5xx do not throw; obtain the failure as a value with `toResult()`
// and narrow it with an error predicate.
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

  // Per-call tweaks: `withQuery` returns a new request with the patch merged
  // over the factory's defaults.
  const recent = await send(
    connector,
    withQuery(listUserRepos('saloonphp', 5), { sort: 'updated' }),
  );
  for (const r of recent.dto()) {
    console.log(`  ${r.stars.toString().padStart(6)}  ${r.fullName}`);
  }
}

await main();

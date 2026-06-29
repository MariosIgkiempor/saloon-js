// Smoke test for the README quickstart / `examples/github-api`. It builds the
// exact GitHub SDK the docs lead with, importing *only* from the public barrel
// (`@/index` is the alias for `src/index.ts`), and exercises it against the mock
// client. If the public surface drifts, this test stops compiling or fails —
// keeping the documented API and the shipped API honest.

import { describe, expect, it } from 'vitest';
import {
  acceptsJson,
  createMockClient,
  defineConnector,
  defineRequest,
  isErr,
  isNotFoundError,
  Method,
  mockResponse,
  send,
  tokenAuth,
} from '@/index';

interface Repo {
  fullName: string;
  stars: number;
}

const gitHub = (token: string) =>
  defineConnector({
    baseUrl: 'https://api.github.com',
    auth: tokenAuth(token),
    plugins: [acceptsJson()],
  });

const getRepo = (owner: string, repo: string) =>
  defineRequest({
    method: Method.GET,
    endpoint: `/repos/${owner}/${repo}`,
    validator: (data): Repo => {
      const raw = data as Record<string, unknown>;
      return { fullName: raw.full_name as string, stars: raw.stargazers_count as number };
    },
  });

describe('examples/github-api quickstart', () => {
  it('maps a successful response into its DTO', async () => {
    const mock = createMockClient([
      mockResponse({ full_name: 'saloonphp/saloon', stargazers_count: 3200 }),
    ]);

    const res = await send(gitHub('token'), getRepo('saloonphp', 'saloon'), { mockClient: mock });

    expect(res.successful()).toBe(true);
    expect(res.dto()).toEqual({ fullName: 'saloonphp/saloon', stars: 3200 });
  });

  it('surfaces a 404 as an isNotFoundError without throwing', async () => {
    const mock = createMockClient([mockResponse({ message: 'Not Found' }, 404)]);

    const res = await send(gitHub('token'), getRepo('saloonphp', 'nope'), { mockClient: mock });

    expect(res.failed()).toBe(true);
    const result = res.toResult();
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(isNotFoundError(result.error)).toBe(true);
    }
  });

  it('sends the bearer token and Accept header from the connector', async () => {
    const mock = createMockClient([mockResponse({ full_name: 'a/b', stargazers_count: 1 })]);

    await send(gitHub('secret-token'), getRepo('a', 'b'), { mockClient: mock });

    const pending = mock.getLastPendingRequest();
    expect(pending?.headers.get('Authorization')).toBe('Bearer secret-token');
    expect(pending?.headers.get('Accept')).toBe('application/json');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Method } from '@/enums';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { createFetchSender } from '@/http/senders/fetchSender';

/** A fetch double that stamps the (fake) clock when it is finally invoked. */
function stampingFetch(stamp: { at: number | null }): typeof fetch {
  return (async () => {
    stamp.at = Date.now();
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

describe('delay middleware', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits the configured delay before sending', async () => {
    vi.useFakeTimers();
    const stamp: { at: number | null } = { at: null };
    const connector = defineConnector({
      baseUrl: 'https://example.test',
      sender: createFetchSender({ fetch: stampingFetch(stamp) }),
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/x', delay: 1000 });
    const start = Date.now();

    const promise = send(connector, request);

    await vi.advanceTimersByTimeAsync(999);
    expect(stamp.at).toBeNull(); // still waiting

    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(stamp.at).not.toBeNull();
    expect((stamp.at as number) - start).toBe(1000);
  });

  it('a request delay overrides the connector delay', async () => {
    vi.useFakeTimers();
    const stamp: { at: number | null } = { at: null };
    const connector = defineConnector({
      baseUrl: 'https://example.test',
      sender: createFetchSender({ fetch: stampingFetch(stamp) }),
      delay: 5000,
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/x', delay: 200 });
    const start = Date.now();

    const promise = send(connector, request);
    await vi.advanceTimersByTimeAsync(200);
    await promise;

    expect((stamp.at as number) - start).toBe(200);
  });

  it('no delay sends immediately', async () => {
    vi.useFakeTimers();
    const stamp: { at: number | null } = { at: null };
    const connector = defineConnector({
      baseUrl: 'https://example.test',
      sender: createFetchSender({ fetch: stampingFetch(stamp) }),
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/x' });
    const start = Date.now();

    const promise = send(connector, request);
    await vi.advanceTimersByTimeAsync(0);
    await promise;

    expect((stamp.at as number) - start).toBe(0);
  });
});

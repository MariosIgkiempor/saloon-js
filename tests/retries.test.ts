import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockValue } from '@/contracts/MockClient';
import { Method } from '@/enums';
import { isFatalRequestError, isNotFoundError, isRequestError, isServerError } from '@/errors';
import { createMockClient } from '@/faking/mockClient';
import { mockResponse } from '@/faking/mockResponse';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { createFetchSender } from '@/http/senders/fetchSender';
import { withRetry } from '@/http/transformers';
import { startTestServer, type TestServer } from './support/testServer';

/** Run `promise`, returning the rejection reason (or failing if it resolves). */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject, but it resolved');
}

/** A fetch double that returns the given status, recording the (fake) clock per call. */
function recordingFetch(status: number, calls: number[]): typeof fetch {
  return (async () => {
    calls.push(Date.now());
    return new Response(JSON.stringify({ status }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('retries (live server)', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => {
    await server.close();
  });
  beforeEach(() => {
    server.reset();
  });

  it('retries a flaky endpoint until it succeeds within tries', async () => {
    const connector = defineConnector({ baseUrl: server.url, tries: 3 });
    const request = defineRequest({ method: Method.GET, endpoint: '/flaky?key=ok&fails=2' });

    const response = await send(connector, request);

    expect(response.status()).toBe(200);
    expect(server.requests).toHaveLength(3);
  });

  it('returns the last failed response when throwOnMaxTries is false', async () => {
    const connector = defineConnector({ baseUrl: server.url, tries: 2, throwOnMaxTries: false });
    const request = defineRequest({ method: Method.GET, endpoint: '/flaky?key=fail&fails=5' });

    const response = await send(connector, request);

    expect(response.status()).toBe(503);
    expect(server.requests).toHaveLength(2);
  });

  it('throws the last error when retries are exhausted (default)', async () => {
    const connector = defineConnector({ baseUrl: server.url, tries: 2 });
    const request = defineRequest({ method: Method.GET, endpoint: '/flaky?key=boom&fails=5' });

    const error = await rejectionOf(send(connector, request));

    expect(isServerError(error)).toBe(true);
    expect(server.requests).toHaveLength(2);
  });

  it('stops retrying when handleRetry returns false', async () => {
    let gateCalls = 0;
    const connector = defineConnector({
      baseUrl: server.url,
      tries: 5,
      handleRetry: () => {
        gateCalls += 1;
        return false;
      },
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/flaky?key=stop&fails=5' });

    const error = await rejectionOf(send(connector, request));

    expect(isRequestError(error)).toBe(true);
    expect(gateCalls).toBe(1);
    expect(server.requests).toHaveLength(1);
  });

  it('handleRetry can inspect the error to skip non-5xx failures', async () => {
    const connector = defineConnector({
      baseUrl: server.url,
      tries: 3,
      handleRetry: (error) => isServerError(error),
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/status/404' });

    const error = await rejectionOf(send(connector, request));

    expect(isNotFoundError(error)).toBe(true);
    expect(server.requests).toHaveLength(1);
  });

  it('withRetry overrides connector tries per request', async () => {
    const connector = defineConnector({ baseUrl: server.url, tries: 1 });
    const request = withRetry(
      defineRequest({ method: Method.GET, endpoint: '/flaky?key=override&fails=1' }),
      { tries: 2 },
    );

    const response = await send(connector, request);

    expect(response.status()).toBe(200);
    expect(server.requests).toHaveLength(2);
  });
});

describe('retries (timing & transport)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits with exponential backoff between attempts', async () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const connector = defineConnector({
      baseUrl: 'https://example.test',
      sender: createFetchSender({ fetch: recordingFetch(503, calls) }),
      tries: 3,
      retryInterval: 200,
      useExponentialBackoff: true,
      throwOnMaxTries: false,
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/x' });
    const start = Date.now();

    const promise = send(connector, request);

    // Attempt 1 fires immediately (no wait before the first try).
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);

    // First backoff: interval · 2^0 = 200ms.
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toHaveLength(2);

    // Second backoff: interval · 2^1 = 400ms.
    await vi.advanceTimersByTimeAsync(400);
    expect(calls).toHaveLength(3);

    const response = await promise;
    expect(response.status()).toBe(503);
    expect(calls.map((t) => t - start)).toEqual([0, 200, 600]);
  });

  it('does not retry a fake .throw() — it escapes immediately', async () => {
    // A keyed mock is reusable, so if the default .throw() (a RequestError) were
    // retried, every attempt would re-serve it and the send would record `tries`
    // round-trips before failing. It should escape after a single attempt instead.
    const mock = createMockClient(
      new Map<unknown, MockValue>([['getThing', mockResponse({ error: true }, 503).throw()]]),
    );
    const connector = defineConnector({
      baseUrl: 'https://api.example.com',
      name: 'api',
      tries: 3,
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/thing', name: 'getThing' });

    const error = await rejectionOf(send(connector, request, { mockClient: mock }));

    expect(isRequestError(error)).toBe(true);
    expect(mock.getRecordedResponses()).toHaveLength(1);
  });

  it('runs the fatal pipeline on each transport failure, then throws', async () => {
    let fatalCalls = 0;
    const failingFetch = (async () => {
      throw new Error('connection refused');
    }) as typeof fetch;
    const connector = defineConnector({
      baseUrl: 'https://example.test',
      sender: createFetchSender({ fetch: failingFetch }),
      tries: 2,
      middleware: (pipeline) =>
        pipeline.onFatalException(() => {
          fatalCalls += 1;
        }),
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/x' });

    const error = await rejectionOf(send(connector, request));

    expect(isFatalRequestError(error)).toBe(true);
    expect(fatalCalls).toBe(2);
  });
});

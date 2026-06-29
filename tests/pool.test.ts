import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Method } from '@/enums';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { type PoolKey, pool } from '@/http/pool';
import { alwaysThrowOnErrors } from '@/plugins';
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

describe('pool', () => {
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

  it('never exceeds the concurrency bound', async () => {
    const connector = defineConnector({ baseUrl: server.url });
    const requests = Array.from({ length: 9 }, () =>
      defineRequest({ method: Method.GET, endpoint: '/concurrent?ms=40' }),
    );
    const seen: PoolKey[] = [];

    await pool(connector, { requests })
      .withResponseHandler((_response, key) => {
        seen.push(key);
      })
      .setConcurrency(3)
      .send();

    expect(server.maxInFlight).toBeLessThanOrEqual(3);
    expect(server.requests).toHaveLength(9);
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('dispatches onResponse and onError per item by key', async () => {
    const connector = defineConnector({ baseUrl: server.url, plugins: [alwaysThrowOnErrors()] });
    const oks: PoolKey[] = [];
    const errs: PoolKey[] = [];

    await pool(connector, {
      requests: [
        defineRequest({ method: Method.GET, endpoint: '/status/200' }),
        defineRequest({ method: Method.GET, endpoint: '/status/500' }),
      ],
      concurrency: 2,
      onResponse: (_response, key) => oks.push(key),
      onError: (_reason, key) => errs.push(key),
    }).send();

    expect(oks).toEqual([0]);
    expect(errs).toEqual([1]);
  });

  it('does not route a throwing onResponse handler to onError', async () => {
    const connector = defineConnector({ baseUrl: server.url });
    const errs: PoolKey[] = [];

    const error = await rejectionOf(
      pool(connector, {
        requests: [defineRequest({ method: Method.GET, endpoint: '/status/200' })],
        onResponse: () => {
          throw new Error('response handler boom');
        },
        onError: (_reason, key) => errs.push(key),
      }).send(),
    );

    expect((error as Error).message).toBe('response handler boom');
    expect(errs).toEqual([]); // a successful request must never reach onError
  });

  it('rejects (and stops) when the request source throws', async () => {
    const connector = defineConnector({ baseUrl: server.url });
    function* generate() {
      yield defineRequest({ method: Method.GET, endpoint: '/concurrent?ms=10' });
      throw new Error('source boom');
    }

    const error = await rejectionOf(pool(connector, { requests: generate, concurrency: 1 }).send());

    expect((error as Error).message).toBe('source boom');
  });

  it('rejects when an onError handler throws', async () => {
    const connector = defineConnector({ baseUrl: server.url, plugins: [alwaysThrowOnErrors()] });

    const error = await rejectionOf(
      pool(connector, {
        requests: [defineRequest({ method: Method.GET, endpoint: '/status/500' })],
        onError: () => {
          throw new Error('error handler boom');
        },
      }).send(),
    );

    expect((error as Error).message).toBe('error handler boom');
  });

  it('pulls requests lazily from a generator at send time', async () => {
    const connector = defineConnector({ baseUrl: server.url });
    let built = 0;
    function* generate() {
      for (const u of ['ada', 'grace', 'edsger']) {
        built += 1;
        yield defineRequest({ method: Method.GET, endpoint: `/concurrent?ms=10&u=${u}` });
      }
    }

    const controller = pool(connector, { requests: generate, concurrency: 1 });
    expect(built).toBe(0); // nothing pulled before send()

    await controller.send();

    expect(built).toBe(3);
    expect(server.requests.filter((r) => r.path === '/concurrent')).toHaveLength(3);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Method } from '@/enums';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { type PoolKey, pool } from '@/http/pool';
import { alwaysThrowOnErrors } from '@/plugins';
import { startTestServer, type TestServer } from './support/testServer';

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

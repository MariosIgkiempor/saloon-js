import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Method } from '@/enums';
import { isFatalRequestError } from '@/errors';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { startTestServer, type TestServer } from '../support/testServer';

interface Echo {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
}

describe('GET round-trip', () => {
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

  const echo = () => defineRequest({ method: Method.GET, endpoint: '/get' });

  it('returns 200 and reads JSON off the response', async () => {
    const response = await send(defineConnector({ baseUrl: server.url }), echo());

    expect(response.status()).toBe(200);
    const body = response.json<Echo>();
    expect(body.method).toBe('GET');
    expect(body.path).toBe('/get');
  });

  it('exposes response headers', async () => {
    const response = await send(defineConnector({ baseUrl: server.url }), echo());

    expect(response.headers().get('content-type')).toContain('application/json');
  });

  it('sends connector headers and query to the server', async () => {
    const connector = defineConnector({
      baseUrl: server.url,
      headers: { 'X-App': 'demo' },
      query: { source: 'connector' },
    });

    const body = (await send(connector, echo())).json<Echo>();
    expect(body.headers['x-app']).toBe('demo');
    expect(body.query.source).toBe('connector');
  });

  it('sends request headers and query, with the request winning over the connector', async () => {
    const connector = defineConnector({
      baseUrl: server.url,
      headers: { 'X-App': 'connector', 'X-Connector-Only': 'yes' },
      query: { who: 'connector' },
    });
    const request = defineRequest({
      method: Method.GET,
      endpoint: '/get',
      headers: { 'X-App': 'request' },
      query: { who: 'request', extra: 'r' },
    });

    const body = (await send(connector, request)).json<Echo>();
    expect(body.headers['x-app']).toBe('request'); // request wins
    expect(body.headers['x-connector-only']).toBe('yes'); // connector preserved
    expect(body.query.who).toBe('request'); // request wins
    expect(body.query.extra).toBe('r');
  });

  it('rejects with a FatalRequestError when the transport fails', async () => {
    const connector = defineConnector({ baseUrl: 'http://127.0.0.1:1' });

    let caught: unknown;
    try {
      await send(connector, echo());
    } catch (error) {
      caught = error;
    }

    expect(isFatalRequestError(caught)).toBe(true);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Method } from '@/enums';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { withConfig, withHeaders, withQuery } from '@/http/transformers';
import { expectOk } from '../support/expectOk';
import { startTestServer, type TestServer } from '../support/testServer';

interface Echo {
  headers: Record<string, string>;
  query: Record<string, string>;
}

describe('connector → request precedence', () => {
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

  describe('headers', () => {
    const connector = () =>
      defineConnector({
        baseUrl: server.url,
        headers: { 'X-App': 'connector', 'X-Connector-Only': 'yes' },
      });

    it('request overrides connector; connector-only header preserved', async () => {
      const request = defineRequest({
        method: Method.GET,
        endpoint: '/get',
        headers: { 'X-App': 'request' },
      });

      const echo = expectOk((await send(connector(), request)).json<Echo>());
      expect(echo.headers['x-app']).toBe('request');
      expect(echo.headers['x-connector-only']).toBe('yes');
    });

    it('withHeaders on the request overrides both connector and request', async () => {
      const request = defineRequest({
        method: Method.GET,
        endpoint: '/get',
        headers: { 'X-App': 'request' },
      });

      const echo = expectOk(
        (await send(connector(), withHeaders(request, { 'X-App': 'override' }))).json<Echo>(),
      );
      expect(echo.headers['x-app']).toBe('override');
    });
  });

  describe('query', () => {
    it('merges connector + request, request winning', async () => {
      const connector = defineConnector({ baseUrl: server.url, query: { who: 'connector' } });
      const request = defineRequest({
        method: Method.GET,
        endpoint: '/get',
        query: { who: 'request', extra: 'r' },
      });

      const echo = expectOk((await send(connector, request)).json<Echo>());
      expect(echo.query.who).toBe('request');
      expect(echo.query.extra).toBe('r');
    });

    it('the query store wins over an inline URL query', async () => {
      const request = defineRequest({
        method: Method.GET,
        endpoint: '/get?who=inline',
        query: { who: 'store' },
      });

      const echo = expectOk(
        (await send(defineConnector({ baseUrl: server.url }), request)).json<Echo>(),
      );
      expect(echo.query.who).toBe('store');
    });

    it('withQuery on the request overrides both', async () => {
      const connector = defineConnector({ baseUrl: server.url, query: { who: 'connector' } });
      const request = defineRequest({
        method: Method.GET,
        endpoint: '/get',
        query: { who: 'request' },
      });

      const echo = expectOk(
        (await send(connector, withQuery(request, { who: 'override' }))).json<Echo>(),
      );
      expect(echo.query.who).toBe('override');
    });
  });

  describe('config', () => {
    // Config is not transmitted in this slice, so precedence is verified on the
    // merged pending request reachable from the response.
    it('merges connector + request, request winning', async () => {
      const connector = defineConnector({
        baseUrl: server.url,
        config: { shared: 'connector', connectorOnly: true },
      });
      const request = defineRequest({
        method: Method.GET,
        endpoint: '/get',
        config: { shared: 'request', requestOnly: 1 },
      });

      const response = await send(connector, request);
      expect(response.getPendingRequest().config.all()).toEqual({
        shared: 'request',
        connectorOnly: true,
        requestOnly: 1,
      });
    });

    it('withConfig on the request overrides both', async () => {
      const connector = defineConnector({ baseUrl: server.url, config: { shared: 'connector' } });
      const request = defineRequest({
        method: Method.GET,
        endpoint: '/get',
        config: { shared: 'request' },
      });

      const response = await send(connector, withConfig(request, { shared: 'override' }));
      expect(response.getPendingRequest().config.get('shared')).toBe('override');
    });
  });
});

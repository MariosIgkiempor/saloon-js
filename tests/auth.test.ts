import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { basicAuth, headerAuth, multiAuth, queryAuth, tokenAuth } from '@/auth';
import { Method } from '@/enums';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { withAuth } from '@/http/transformers';
import { expectOk } from './support/expectOk';
import { startTestServer, type TestServer } from './support/testServer';

interface Echo {
  headers: Record<string, string>;
  query: Record<string, string>;
}

describe('auth', () => {
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

  const get = defineRequest({ method: Method.GET, endpoint: '/get' });
  const echoOf = async (connector: ReturnType<typeof defineConnector>, request = get) =>
    expectOk((await send(connector, request)).json<Echo>());

  it('tokenAuth sets a Bearer Authorization header', async () => {
    const echo = await echoOf(defineConnector({ baseUrl: server.url, auth: tokenAuth('abc123') }));
    expect(echo.headers.authorization).toBe('Bearer abc123');
  });

  it('tokenAuth honors a custom prefix', async () => {
    const echo = await echoOf(
      defineConnector({ baseUrl: server.url, auth: tokenAuth('abc123', 'Token') }),
    );
    expect(echo.headers.authorization).toBe('Token abc123');
  });

  it('basicAuth sets a base64 Basic header', async () => {
    const echo = await echoOf(
      defineConnector({ baseUrl: server.url, auth: basicAuth('user', 'p@ss') }),
    );
    const expected = `Basic ${Buffer.from('user:p@ss', 'utf8').toString('base64')}`;
    expect(echo.headers.authorization).toBe(expected);
  });

  it('headerAuth sets a custom header', async () => {
    const echo = await echoOf(
      defineConnector({ baseUrl: server.url, auth: headerAuth('secret', 'X-Api-Key') }),
    );
    expect(echo.headers['x-api-key']).toBe('secret');
  });

  it('queryAuth adds a query parameter', async () => {
    const echo = await echoOf(
      defineConnector({ baseUrl: server.url, auth: queryAuth('api_key', 'secret') }),
    );
    expect(echo.query.api_key).toBe('secret');
  });

  it('multiAuth applies every authenticator', async () => {
    const echo = await echoOf(
      defineConnector({
        baseUrl: server.url,
        auth: multiAuth(headerAuth('a', 'X-A'), queryAuth('b', '1')),
      }),
    );
    expect(echo.headers['x-a']).toBe('a');
    expect(echo.query.b).toBe('1');
  });

  it('resolves a thunk authenticator per send', async () => {
    const echo = await echoOf(
      defineConnector({ baseUrl: server.url, auth: () => tokenAuth('lazy') }),
    );
    expect(echo.headers.authorization).toBe('Bearer lazy');
  });

  it('request auth beats connector auth', async () => {
    const connector = defineConnector({ baseUrl: server.url, auth: tokenAuth('connector') });
    const request = defineRequest({
      method: Method.GET,
      endpoint: '/get',
      auth: tokenAuth('request'),
    });

    const echo = expectOk((await send(connector, request)).json<Echo>());
    expect(echo.headers.authorization).toBe('Bearer request');
  });

  it('withAuth overrides both connector and request auth', async () => {
    const connector = defineConnector({ baseUrl: server.url, auth: tokenAuth('connector') });
    const request = defineRequest({
      method: Method.GET,
      endpoint: '/get',
      auth: tokenAuth('request'),
    });

    const echo = expectOk(
      (await send(connector, withAuth(request, tokenAuth('override')))).json<Echo>(),
    );
    expect(echo.headers.authorization).toBe('Bearer override');
  });
});

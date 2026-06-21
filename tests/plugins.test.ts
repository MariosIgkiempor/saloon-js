import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Method } from '@/enums';
import { isFatalRequestError, isServerError } from '@/errors';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { acceptsJson, alwaysThrowOnErrors, hasTimeout } from '@/plugins';
import { expectOk } from './support/expectOk';
import { startTestServer, type TestServer } from './support/testServer';

interface Echo {
  headers: Record<string, string>;
}

/** Run `promise`, returning the rejection reason (or failing if it resolves). */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject, but it resolved');
}

describe('plugins', () => {
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

  it('acceptsJson sets the Accept header', async () => {
    const connector = defineConnector({ baseUrl: server.url, plugins: [acceptsJson()] });
    const request = defineRequest({ method: Method.GET, endpoint: '/get' });

    const echo = expectOk((await send(connector, request)).json<Echo>());
    expect(echo.headers.accept).toBe('application/json');
  });

  it('hasTimeout aborts a slow request as a FatalRequestError', async () => {
    const connector = defineConnector({
      baseUrl: server.url,
      plugins: [hasTimeout({ request: 50 })],
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/slow?ms=2000' });

    const error = await rejectionOf(send(connector, request));
    expect(isFatalRequestError(error)).toBe(true);
  });

  it('alwaysThrowOnErrors makes a 500 response throw a ServerError', async () => {
    const connector = defineConnector({
      baseUrl: server.url,
      plugins: [alwaysThrowOnErrors()],
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/status/500' });

    const error = await rejectionOf(send(connector, request));
    expect(isServerError(error)).toBe(true);
  });

  it('alwaysThrowOnErrors leaves a successful response untouched', async () => {
    const connector = defineConnector({
      baseUrl: server.url,
      plugins: [alwaysThrowOnErrors()],
    });
    const request = defineRequest({ method: Method.GET, endpoint: '/status/200' });

    const response = await send(connector, request);
    expect(response.status()).toBe(200);
  });
});

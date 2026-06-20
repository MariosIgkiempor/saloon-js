import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Method } from '@/enums';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { formBody } from '@/repositories/body/formBody';
import { jsonBody } from '@/repositories/body/jsonBody';
import { multipartBody } from '@/repositories/body/multipartBody';
import { stringBody } from '@/repositories/body/stringBody';
import { startTestServer, type TestServer } from '../support/testServer';

interface Echo {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string;
}

describe('POST with a body', () => {
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

  const api = () => defineConnector({ baseUrl: server.url });

  it('sends a JSON body with application/json', async () => {
    const request = defineRequest({
      method: Method.POST,
      endpoint: '/post',
      body: jsonBody({ name: 'Ada' }),
    });

    const echo = (await send(api(), request)).json<Echo>();
    expect(echo.method).toBe('POST');
    expect(echo.headers['content-type']).toContain('application/json');
    expect(echo.body).toEqual({ name: 'Ada' });
  });

  it('sends a form body as application/x-www-form-urlencoded', async () => {
    const request = defineRequest({
      method: Method.POST,
      endpoint: '/post',
      body: formBody({ a: '1', b: '2' }),
    });

    const echo = (await send(api(), request)).json<Echo>();
    expect(echo.headers['content-type']).toContain('application/x-www-form-urlencoded');
    expect(echo.body).toEqual({ a: '1', b: '2' });
  });

  it('sends a multipart body with a boundary and no manual content type', async () => {
    const request = defineRequest({
      method: Method.POST,
      endpoint: '/post',
      body: multipartBody([{ name: 'field', value: 'value' }]),
    });

    const echo = (await send(api(), request)).json<Echo>();
    expect(echo.headers['content-type']).toContain('multipart/form-data');
    expect(echo.headers['content-type']).toContain('boundary=');
    expect(echo.rawBody).toContain('name="field"');
    expect(echo.rawBody).toContain('value');
  });

  it('sends a raw string body with the explicit content type', async () => {
    const request = defineRequest({
      method: Method.POST,
      endpoint: '/post',
      body: stringBody('raw payload', 'text/plain'),
    });

    const echo = (await send(api(), request)).json<Echo>();
    expect(echo.headers['content-type']).toContain('text/plain');
    expect(echo.rawBody).toBe('raw payload');
  });
});

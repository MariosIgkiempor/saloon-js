import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Method } from '@/enums';
import { isNotFoundError, isRequestError } from '@/errors';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { isErr, isOk } from '@/result';
import { startTestServer, type TestServer } from '../support/testServer';

describe('Response reading API', () => {
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

  const connector = () => defineConnector({ baseUrl: server.url });
  const get = (endpoint: string) => defineRequest({ method: Method.GET, endpoint });
  // /status/:code returns { status, error: { code, message } }.
  const status = (code: number) => get(`/status/${code}`);

  describe('body reading', () => {
    it('reads the raw body and parses JSON', async () => {
      const response = await send(connector(), get('/get'));
      expect(typeof response.body()).toBe('string');
      const body = response.json<{ path: string }>();
      expect(body.path).toBe('/get');
    });

    it('reads a dot-path off the JSON body with a default fallback', async () => {
      const response = await send(connector(), status(404));
      expect(response.json<string>('error.message')).toBe('responded with 404');
      expect(response.json<string>('error.missing', 'fallback')).toBe('fallback');
      expect(response.json('does.not.exist')).toBeUndefined();
    });

    it('object() returns the whole parsed body', async () => {
      const response = await send(connector(), get('/get'));
      expect(response.object<{ method: string }>().method).toBe('GET');
    });

    it('reads a single header case-insensitively', async () => {
      const response = await send(connector(), get('/get'));
      expect(response.header('Content-Type')).toContain('application/json');
      expect(response.header('x-not-present')).toBeUndefined();
    });
  });

  describe('status predicates', () => {
    it('ok() and successful() for 200', async () => {
      const response = await send(connector(), status(200));
      expect(response.ok()).toBe(true);
      expect(response.successful()).toBe(true);
      expect(response.failed()).toBe(false);
      expect(response.redirect()).toBe(false);
      expect(response.clientError()).toBe(false);
      expect(response.serverError()).toBe(false);
    });

    it('successful() but not ok() for 201', async () => {
      const response = await send(connector(), status(201));
      expect(response.ok()).toBe(false);
      expect(response.successful()).toBe(true);
    });

    it('redirect() for 301', async () => {
      const response = await send(connector(), status(301));
      expect(response.redirect()).toBe(true);
      expect(response.successful()).toBe(false);
      expect(response.failed()).toBe(false);
    });

    it('clientError() and failed() for 404', async () => {
      const response = await send(connector(), status(404));
      expect(response.clientError()).toBe(true);
      expect(response.serverError()).toBe(false);
      expect(response.failed()).toBe(true);
      expect(response.successful()).toBe(false);
    });

    it('serverError() and failed() for 500', async () => {
      const response = await send(connector(), status(500));
      expect(response.serverError()).toBe(true);
      expect(response.clientError()).toBe(false);
      expect(response.failed()).toBe(true);
    });
  });

  describe('onError', () => {
    it('fires the callback only when the response failed', async () => {
      let calls = 0;
      const okResponse = await send(connector(), status(200));
      okResponse.onError(() => {
        calls += 1;
      });
      expect(calls).toBe(0);

      const failResponse = await send(connector(), status(503));
      const returned = failResponse.onError((r) => {
        calls += 1;
        expect(r.status()).toBe(503);
      });
      expect(calls).toBe(1);
      expect(returned).toBe(failResponse); // chainable
    });
  });

  describe('toResult — the failure as a value (no throwing)', () => {
    it('a 4xx does NOT throw and resolves to a Response', async () => {
      // The send itself must resolve, not reject, on an error status.
      const response = await send(connector(), status(404));
      expect(response.status()).toBe(404);
    });

    it('Ok(response) for a successful round-trip', async () => {
      const response = await send(connector(), status(200));
      const result = response.toResult();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(response);
      }
    });

    it('Err(RequestError) for a failed round-trip, mapped to the status kind', async () => {
      const response = await send(connector(), status(404));
      const result = response.toResult();
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(isRequestError(result.error)).toBe(true);
        expect(isNotFoundError(result.error)).toBe(true);
        expect(result.error.getStatus()).toBe(404);
        expect(result.error.getResponse()).toBe(response);
      }
    });

    it('the failure value carries a useful default message', async () => {
      const response = await send(connector(), status(500));
      const result = response.toResult();
      if (isErr(result)) {
        expect(result.error.message).toContain('(500)');
        expect(result.error.message).toContain('responded with 500');
      }
    });
  });
});

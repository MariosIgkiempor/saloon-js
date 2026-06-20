import { describe, expect, it } from 'vitest';
import { Method } from '@/enums';
import { BodyException, isBodyException } from '@/errors';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { createPendingRequest } from '@/http/pendingRequest';
import { formBody } from '@/repositories/body/formBody';
import { jsonBody } from '@/repositories/body/jsonBody';
import { multipartBody } from '@/repositories/body/multipartBody';
import { streamBody } from '@/repositories/body/streamBody';
import { stringBody } from '@/repositories/body/stringBody';

describe('body repositories', () => {
  describe('mergeable bodies', () => {
    it('json merge lets the request keys win', () => {
      expect(jsonBody({ a: 1, b: 1 }).merge({ b: 2, c: 3 }).all()).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('form merge lets the request keys win', () => {
      expect(formBody({ a: '1', b: '1' }).merge({ b: '2', c: '3' }).all()).toEqual({
        a: '1',
        b: '2',
        c: '3',
      });
    });

    it('multipart merge concatenates fields (array_merge re-indexes)', () => {
      const merged = multipartBody([{ name: 'a', value: '1' }])
        .merge([{ name: 'b', value: '2' }])
        .all();
      expect(merged).toEqual([
        { name: 'a', value: '1' },
        { name: 'b', value: '2' },
      ]);
    });
  });

  describe('clone independence', () => {
    it('mutating a clone never touches the original (json)', () => {
      const original = jsonBody({ a: 1 });
      original.clone().merge({ a: 99, b: 2 });
      expect(original.all()).toEqual({ a: 1 });
    });

    it('mutating a clone never touches the original (multipart)', () => {
      const original = multipartBody([{ name: 'a', value: '1' }]);
      (original.clone() as ReturnType<typeof multipartBody>).attach({ name: 'b', value: '2' });
      expect(original.all()).toEqual([{ name: 'a', value: '1' }]);
    });
  });

  describe('isEmpty (PHP empty() semantics)', () => {
    it('treats empty string, null and the quirky "0" as empty', () => {
      expect(stringBody('').isEmpty()).toBe(true);
      expect(stringBody(null).isEmpty()).toBe(true);
      expect(stringBody('0').isEmpty()).toBe(true); // the PHP quirk
      expect(stringBody('x').isEmpty()).toBe(false);
    });

    it('treats a keyless array body as empty, but not one with a falsy value', () => {
      expect(jsonBody({}).isEmpty()).toBe(true);
      expect(jsonBody({ a: 0 }).isEmpty()).toBe(false);
      expect(multipartBody([]).isEmpty()).toBe(true);
    });

    it('treats only a missing stream as empty', () => {
      expect(streamBody(null).isEmpty()).toBe(true);
      expect(streamBody(new Blob(['x'])).isEmpty()).toBe(false);
    });
  });

  describe('toRequestBody', () => {
    it('json serializes and types as application/json', () => {
      expect(jsonBody({ name: 'Ada' }).toRequestBody()).toEqual({
        body: '{"name":"Ada"}',
        contentType: 'application/json',
      });
    });

    it('form serializes as urlencoded', () => {
      const { body, contentType } = formBody({ a: '1', b: '2' }).toRequestBody();
      expect(contentType).toBe('application/x-www-form-urlencoded');
      expect(String(body)).toBe('a=1&b=2');
    });

    it('multipart defers the content type to fetch (boundary)', () => {
      const { body, contentType } = multipartBody([{ name: 'a', value: '1' }]).toRequestBody();
      expect(contentType).toBeNull();
      expect(body).toBeInstanceOf(FormData);
    });

    it('string carries the explicit content type', () => {
      expect(stringBody('raw', 'text/plain').toRequestBody()).toEqual({
        body: 'raw',
        contentType: 'text/plain',
      });
    });
  });

  describe('MergeBody tap (via createPendingRequest)', () => {
    it('merges connector then request, request winning, without mutating either', () => {
      const connector = defineConnector({ baseUrl: 'https://x', body: jsonBody({ a: 1, b: 1 }) });
      const request = defineRequest({
        method: Method.POST,
        endpoint: '/',
        body: jsonBody({ b: 2, c: 3 }),
      });

      const pending = createPendingRequest(connector, request);
      expect(pending.getBody()?.all()).toEqual({ a: 1, b: 2, c: 3 });
      // Originals are untouched.
      expect((connector.body as ReturnType<typeof jsonBody>).all()).toEqual({ a: 1, b: 1 });
      expect((request.body as ReturnType<typeof jsonBody>).all()).toEqual({ b: 2, c: 3 });
    });

    it('throws BodyException when connector and request body kinds differ', () => {
      const connector = defineConnector({ baseUrl: 'https://x', body: jsonBody({ a: 1 }) });
      const request = defineRequest({
        method: Method.POST,
        endpoint: '/',
        body: formBody({ a: '1' }),
      });

      let caught: unknown;
      try {
        createPendingRequest(connector, request);
      } catch (error) {
        caught = error;
      }
      expect(isBodyException(caught)).toBe(true);
      expect(caught).toBeInstanceOf(BodyException);
    });

    it('request body wins wholesale for non-mergeable kinds (string)', () => {
      const connector = defineConnector({ baseUrl: 'https://x', body: stringBody('connector') });
      const request = defineRequest({
        method: Method.POST,
        endpoint: '/',
        body: stringBody('request'),
      });

      const pending = createPendingRequest(connector, request);
      expect(pending.getBody()?.all()).toBe('request');
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { Response } from '@/contracts/Response';
import { createRequestError, RequestError } from '@/errors/RequestError';
import { SaloonError } from '@/errors/SaloonError';

// A minimal Response stub — only the members createRequestError / the default
// message read are wired. Avoids spinning up the live server for pure mapping.
function stubResponse(status: number, body = '', statusText = ''): Response {
  return {
    status: () => status,
    body: () => body,
    clientError: () => status >= 400 && status < 500,
    serverError: () => status >= 500,
    getFetchResponse: () => ({ statusText }) as globalThis.Response,
    // Unused by the paths under test:
  } as unknown as Response;
}

describe('createRequestError', () => {
  it.each([
    [401, 'unauthorized'],
    [402, 'paymentRequired'],
    [403, 'forbidden'],
    [404, 'notFound'],
    [405, 'methodNotAllowed'],
    [408, 'requestTimeout'],
    [422, 'unprocessableEntity'],
    [429, 'tooManyRequests'],
    [500, 'internalServerError'],
    [503, 'serviceUnavailable'],
    [504, 'gatewayTimeout'],
  ])('maps exact status %i to kind %s', (status, kind) => {
    expect(createRequestError(stubResponse(status)).kind).toBe(kind);
  });

  it('falls back to clientError for an unmapped 4xx (418)', () => {
    expect(createRequestError(stubResponse(418)).kind).toBe('clientError');
  });

  it('falls back to serverError for an unmapped 5xx (599)', () => {
    expect(createRequestError(stubResponse(599)).kind).toBe('serverError');
  });

  it('falls back to requestError for a non-4xx/5xx flagged failure (302)', () => {
    expect(createRequestError(stubResponse(302)).kind).toBe('requestError');
  });

  it('carries the status and threads `cause`', () => {
    const cause = new Error('root');
    const error = createRequestError(stubResponse(500), cause);
    expect(error.status).toBe(500);
    expect(error.getStatus()).toBe(500);
    expect(error.cause).toBe(cause);
  });
});

describe('RequestError message', () => {
  it('uses the "statusText (status) Response: body" template', () => {
    const error = createRequestError(stubResponse(404, '{"error":"missing"}', 'Not Found'));
    expect(error.message).toBe('Not Found (404) Response: {"error":"missing"}');
  });

  it('falls back to "Unknown Status" when statusText is empty', () => {
    const error = createRequestError(stubResponse(404, 'x'));
    expect(error.message).toBe('Unknown Status (404) Response: x');
  });

  it('truncates the body excerpt to 2000 characters', () => {
    const body = 'a'.repeat(5000);
    const error = createRequestError(stubResponse(500, body, 'Internal Server Error'));
    const excerpt = error.message.split('Response: ')[1] ?? '';
    expect(excerpt.length).toBe(2000);
  });
});

describe('RequestError inheritance', () => {
  it('is a SaloonError and an Error', () => {
    const error = createRequestError(stubResponse(404));
    expect(error).toBeInstanceOf(RequestError);
    expect(error).toBeInstanceOf(SaloonError);
    expect(error).toBeInstanceOf(Error);
  });

  it('exposes the response and pending request accessors', () => {
    const response = stubResponse(404);
    const error = createRequestError(response);
    expect(error.getResponse()).toBe(response);
  });
});

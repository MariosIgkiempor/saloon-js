import { describe, expect, it } from 'vitest';
import type { Response } from '@/contracts/Response';
import { FatalRequestError } from '@/errors/FatalRequestError';
import {
  isClientError,
  isFatalRequestError,
  isForbiddenError,
  isGatewayTimeoutError,
  isInternalServerError,
  isMethodNotAllowedError,
  isNotFoundError,
  isPaymentRequiredError,
  isRequestError,
  isRequestTimeoutError,
  isSaloonError,
  isServerError,
  isServiceUnavailableError,
  isTooManyRequestsError,
  isUnauthorizedError,
  isUnprocessableEntityError,
} from '@/errors/predicates';
import { createRequestError } from '@/errors/RequestError';
import { SaloonError } from '@/errors/SaloonError';

function stubResponse(status: number): Response {
  return {
    status: () => status,
    body: () => '',
    clientError: () => status >= 400 && status < 500,
    serverError: () => status >= 500,
    getFetchResponse: () => ({ statusText: '' }) as globalThis.Response,
  } as unknown as Response;
}

const error = (status: number) => createRequestError(stubResponse(status));

describe('isRequestError', () => {
  it('is true for any RequestError, regardless of status', () => {
    expect(isRequestError(error(404))).toBe(true);
    expect(isRequestError(error(500))).toBe(true);
    expect(isRequestError(error(302))).toBe(true);
  });

  it('is false for unrelated errors and non-errors', () => {
    expect(isRequestError(new SaloonError('plain'))).toBe(false);
    expect(isRequestError(new Error('plain'))).toBe(false);
    expect(isRequestError('nope')).toBe(false);
    expect(isRequestError(undefined)).toBe(false);
    expect(isRequestError({ status: 404, kind: 'notFound' })).toBe(false);
  });
});

describe('isClientError / isServerError families', () => {
  it('isClientError covers every 4xx, including named ones', () => {
    expect(isClientError(error(404))).toBe(true);
    expect(isClientError(error(418))).toBe(true);
    expect(isClientError(error(500))).toBe(false);
  });

  it('isServerError covers every 5xx, including named ones', () => {
    expect(isServerError(error(500))).toBe(true);
    expect(isServerError(error(599))).toBe(true);
    expect(isServerError(error(404))).toBe(false);
  });
});

describe('per-status predicates', () => {
  it.each([
    [401, isUnauthorizedError],
    [402, isPaymentRequiredError],
    [403, isForbiddenError],
    [404, isNotFoundError],
    [405, isMethodNotAllowedError],
    [408, isRequestTimeoutError],
    [422, isUnprocessableEntityError],
    [429, isTooManyRequestsError],
    [500, isInternalServerError],
    [503, isServiceUnavailableError],
    [504, isGatewayTimeoutError],
  ])('status %i narrows via its own predicate', (status, predicate) => {
    expect(predicate(error(status))).toBe(true);
    // A different status must not match this predicate.
    expect(predicate(error(status === 404 ? 403 : 404))).toBe(false);
  });

  it('returns false for non-RequestErrors', () => {
    expect(isNotFoundError(new Error('x'))).toBe(false);
    expect(isInternalServerError('x')).toBe(false);
  });
});

describe('Slice 1 predicates still work alongside the new ones', () => {
  it('isSaloonError / isFatalRequestError', () => {
    const fatal = new FatalRequestError(new Error('refused'), {} as never);
    expect(isFatalRequestError(fatal)).toBe(true);
    expect(isSaloonError(fatal)).toBe(true);
    expect(isSaloonError(error(404))).toBe(true);
    expect(isRequestError(fatal)).toBe(false);
    expect(isFatalRequestError(error(404))).toBe(false);
  });
});

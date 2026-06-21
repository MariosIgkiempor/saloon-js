import { describe, expect, it } from 'vitest';
import { Method } from '@/enums';
import { isServerError } from '@/errors';
import { createMockClient } from '@/faking/mockClient';
import { mockResponse } from '@/faking/mockResponse';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { expectOk } from '../support/expectOk';

// No server: with a mock client the sender is never reached, so the base URL is
// never fetched.
const api = defineConnector({ baseUrl: 'https://api.example.com', name: 'api' });
const getThing = defineRequest({ method: Method.GET, endpoint: '/things/1', name: 'getThing' });

describe('mockResponse', () => {
  it('exposes body, status and headers', () => {
    const fake = mockResponse({ id: 1 }, 201, { 'x-test': 'yes' });
    expect(fake.status()).toBe(201);
    expect(fake.headers().get('x-test')).toBe('yes');
    expect(fake.body().kind).toBe('json');
    expect(fake.body().all()).toEqual({ id: 1 });
  });

  it('a mocked send returns the body and is flagged isMocked()', async () => {
    const mock = createMockClient();
    mock.addResponse(mockResponse({ id: '1', name: 'Ada' }));

    const res = await send(api, getThing, { mockClient: mock });

    expect(res.isMocked()).toBe(true);
    expect(res.isCached()).toBe(false);
    expect(res.status()).toBe(200);
    expect(expectOk(res.json())).toEqual({ id: '1', name: 'Ada' });
  });

  it('a string body becomes the raw response body', async () => {
    const mock = createMockClient();
    mock.addResponse(mockResponse('plain text', 200));

    const res = await send(api, getThing, { mockClient: mock });

    expect(res.body()).toBe('plain text');
  });

  it('honors a custom status', async () => {
    const mock = createMockClient();
    mock.addResponse(mockResponse({}, 404));

    const res = await send(api, getThing, { mockClient: mock });

    expect(res.status()).toBe(404);
    expect(res.failed()).toBe(true);
  });

  it('.throw() rejects the send with a RequestError after recording', async () => {
    const mock = createMockClient();
    mock.addResponse(mockResponse({ message: 'nope' }, 500).throw());

    const error = await send(api, getThing, { mockClient: mock }).then(
      () => null,
      (reason) => reason,
    );

    expect(isServerError(error)).toBe(true);
    // Still recorded, even though the send rejected.
    expect(mock.getRecordedResponses()).toHaveLength(1);
  });

  it('.throw(error) rejects with the supplied error', async () => {
    const mock = createMockClient();
    const boom = new Error('custom boom');
    mock.addResponse(mockResponse({}, 500).throw(boom));

    const error = await send(api, getThing, { mockClient: mock }).then(
      () => null,
      (reason) => reason,
    );

    expect(error).toBe(boom);
  });
});

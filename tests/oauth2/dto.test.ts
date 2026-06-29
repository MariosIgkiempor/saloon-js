import { describe, expect, it } from 'vitest';
import type { Response } from '@/contracts/Response';
import { Method } from '@/enums';
import { isRequestError } from '@/errors';
import { createMockClient } from '@/faking/mockClient';
import { mockResponse } from '@/faking/mockResponse';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { expectOk } from '../support/expectOk';

interface User {
  id: string;
  email: string;
}

const castUser = (response: Response): User => expectOk(response.json<User>());

describe('Response.dto', () => {
  it('casts via the request dto hook and is typed as TDto', async () => {
    const api = defineConnector({ baseUrl: 'https://api.example.com' });
    const getMe = defineRequest<User>({ method: Method.GET, endpoint: '/me', dto: castUser });
    const mock = createMockClient([mockResponse({ id: '1', email: 'ada@example.com' })]);

    const me = await send(api, getMe, { mockClient: mock });
    const user = me.dto();

    // `user` is typed `User` — these property reads compile.
    expect(user.id).toBe('1');
    expect(user.email).toBe('ada@example.com');
  });

  it('falls back to the connector-level dto when the request defines none', async () => {
    const api = defineConnector({ baseUrl: 'https://api.example.com', dto: castUser });
    const getMe = defineRequest<User>({ method: Method.GET, endpoint: '/me' });
    const mock = createMockClient([mockResponse({ id: '2', email: 'grace@example.com' })]);

    const me = await send(api, getMe, { mockClient: mock });
    expect(me.dto().email).toBe('grace@example.com');
  });

  it('returns undefined when neither request nor connector defines a dto', async () => {
    const api = defineConnector({ baseUrl: 'https://api.example.com' });
    const getMe = defineRequest({ method: Method.GET, endpoint: '/me' });
    const mock = createMockClient([mockResponse({ id: '3' })]);

    const me = await send(api, getMe, { mockClient: mock });
    expect(me.dto()).toBeUndefined();
  });

  it('dtoOrFail throws a RequestError on a failed response', async () => {
    const api = defineConnector({ baseUrl: 'https://api.example.com' });
    const getMe = defineRequest<User>({ method: Method.GET, endpoint: '/me', dto: castUser });
    const mock = createMockClient([mockResponse({ message: 'nope' }, 404)]);

    const me = await send(api, getMe, { mockClient: mock });

    expect(() => me.dtoOrFail()).toThrow();
    try {
      me.dtoOrFail();
    } catch (error) {
      expect(isRequestError(error)).toBe(true);
    }
    // The non-throwing accessor still casts the (failed) body.
    expect(me.dto().id).toBeUndefined();
  });
});

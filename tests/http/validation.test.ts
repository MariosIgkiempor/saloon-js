// Response validation: a request/connector `validator` (a function or any Standard
// Schema) infers the response type and is run automatically by `send`. On a
// successful-but-invalid body, `send` throws a `ValidationError`; the return-based
// reads are `validate()`/`validateAsync()`.

import { describe, expect, it } from 'vitest';
import type { StandardSchemaV1 } from '@/contracts/StandardSchema';
import { Method } from '@/enums';
import { isRequestError, isValidationError, ValidationError } from '@/errors';
import { createMockClient } from '@/faking/mockClient';
import { mockResponse } from '@/faking/mockResponse';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { isErr, isOk } from '@/result';
import { expectOk } from '../support/expectOk';

interface User {
  id: string;
  email: string;
}

// A function validator: returns the typed value, or throws on invalid.
const validateUser = (data: unknown): User => {
  const raw = data as Record<string, unknown>;
  if (typeof raw?.id !== 'string' || typeof raw?.email !== 'string') {
    throw new Error('invalid user');
  }
  return { id: raw.id, email: raw.email };
};

// A hand-rolled Standard Schema (no Zod dependency) — proves interop + inference.
const userSchema: StandardSchemaV1<unknown, User> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) => {
      const raw = value as Record<string, unknown>;
      if (typeof raw?.id !== 'string' || typeof raw?.email !== 'string') {
        return { issues: [{ message: 'invalid user' }] };
      }
      return { value: { id: raw.id, email: raw.email } };
    },
  },
};

// An async Standard Schema (its `validate` returns a Promise).
const asyncUserSchema: StandardSchemaV1<unknown, User> = {
  '~standard': {
    version: 1,
    vendor: 'test-async',
    validate: async (value) => userSchema['~standard'].validate(value),
  },
};

const api = () => defineConnector({ baseUrl: 'https://api.example.com' });

describe('response validation', () => {
  it('infers TDto from a function validator and validates the body', async () => {
    const getMe = defineRequest({ method: Method.GET, endpoint: '/me', validator: validateUser });
    const mock = createMockClient([mockResponse({ id: '1', email: 'ada@example.com' })]);

    const me = await send(api(), getMe, { mockClient: mock });
    const user = me.dto();

    // `user` is typed `User` — these property reads compile.
    expect(user.id).toBe('1');
    expect(user.email).toBe('ada@example.com');
  });

  it('infers TDto from a Standard Schema and validates the body', async () => {
    const getMe = defineRequest({ method: Method.GET, endpoint: '/me', validator: userSchema });
    const mock = createMockClient([mockResponse({ id: '2', email: 'grace@example.com' })]);

    const me = await send(api(), getMe, { mockClient: mock });
    expect(me.dto().email).toBe('grace@example.com');
    expect(expectOk(me.validate())).toEqual({ id: '2', email: 'grace@example.com' });
  });

  it('resolves an async Standard Schema via validateAsync / await send', async () => {
    const getMe = defineRequest({
      method: Method.GET,
      endpoint: '/me',
      validator: asyncUserSchema,
    });
    const mock = createMockClient([mockResponse({ id: '3', email: 'lin@example.com' })]);

    const me = await send(api(), getMe, { mockClient: mock });
    expect(isOk(await me.validateAsync())).toBe(true);
    // After send's eager (async) validation memoizes, the sync `dto()` is available.
    expect(me.dto().id).toBe('3');
  });

  it('send throws a ValidationError on a successful but invalid body', async () => {
    const getMe = defineRequest({ method: Method.GET, endpoint: '/me', validator: userSchema });
    const mock = createMockClient([mockResponse({ id: 1 /* wrong type */ })]);

    await expect(send(api(), getMe, { mockClient: mock })).rejects.toBeInstanceOf(ValidationError);
    try {
      await send(api(), getMe, { mockClient: createMockClient([mockResponse({ id: 1 })]) });
    } catch (error) {
      expect(isValidationError(error)).toBe(true);
      if (isValidationError(error)) expect(error.issues.length).toBeGreaterThan(0);
    }
  });

  it('validate() returns err (return-based) without throwing', async () => {
    // `send` only eager-validates successful responses, so a 4xx body never throws
    // during send — it lets us read a non-matching body back as a return-based `err`.
    const getMe = defineRequest({ method: Method.GET, endpoint: '/me', validator: userSchema });
    const mock = createMockClient([mockResponse({ message: 'nope' }, 404)]);
    const me = await send(api(), getMe, { mockClient: mock });

    const result = me.validate();
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(isValidationError(result.error)).toBe(true);
  });

  it('falls back to a connector-level validator when the request defines none', async () => {
    const connector = defineConnector({
      baseUrl: 'https://api.example.com',
      validator: userSchema,
    });
    const getMe = defineRequest({ method: Method.GET, endpoint: '/me' });
    const mock = createMockClient([mockResponse({ id: '4', email: 'edsger@example.com' })]);

    const me = await send(connector, getMe, { mockClient: mock });
    expect(me.dto()).toEqual({ id: '4', email: 'edsger@example.com' });
  });

  it('passes the parsed body through untyped when no validator is configured', async () => {
    const getMe = defineRequest({ method: Method.GET, endpoint: '/me' });
    const mock = createMockClient([mockResponse({ id: '5' })]);

    const me = await send(api(), getMe, { mockClient: mock });
    expect(me.dto()).toEqual({ id: '5' });
  });

  it('does NOT validate a failed (4xx) response; dtoOrFail throws a RequestError', async () => {
    const getMe = defineRequest({ method: Method.GET, endpoint: '/me', validator: userSchema });
    const mock = createMockClient([mockResponse({ message: 'nope' }, 404)]);

    // A 404 short-circuits before validation, so send resolves (no ValidationError).
    const me = await send(api(), getMe, { mockClient: mock });
    expect(me.failed()).toBe(true);

    expect(() => me.dtoOrFail()).toThrow();
    try {
      me.dtoOrFail();
    } catch (error) {
      expect(isRequestError(error)).toBe(true);
    }
  });
});

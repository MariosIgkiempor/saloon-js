import { afterEach, describe, expect, it } from 'vitest';
import type { MockValue } from '@/contracts/MockClient';
import { Method } from '@/enums';
import {
  createMockClient,
  destroyGlobalMockClient,
  getGlobalMockClient,
  setGlobalMockClient,
} from '@/faking/mockClient';
import { mockResponse } from '@/faking/mockResponse';
import { defineConnector } from '@/http/defineConnector';
import { defineRequest } from '@/http/defineRequest';
import { send } from '@/http/send';
import { expectOk } from '../support/expectOk';

const api = defineConnector({ baseUrl: 'https://api.example.com', name: 'api' });
const getUser = (id: string) =>
  defineRequest({ method: Method.GET, endpoint: `/users/${id}`, name: 'getUser' });
const getOrg = (id: string) =>
  defineRequest({ method: Method.GET, endpoint: `/orgs/${id}`, name: 'getOrg' });

function unwrap<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a defined value');
  return value;
}

describe('createMockClient — matching', () => {
  it('matches by request factory (function key, via its name)', async () => {
    const mock = createMockClient(
      new Map<unknown, MockValue>([[getUser, mockResponse({ who: 'user' })]]),
    );
    const res = await send(api, getUser('1'), { mockClient: mock });
    expect(expectOk(res.json())).toEqual({ who: 'user' });
  });

  it('matches by request name (string key)', async () => {
    const mock = createMockClient(
      new Map<unknown, MockValue>([['getUser', mockResponse({ who: 'by-name' })]]),
    );
    const res = await send(api, getUser('1'), { mockClient: mock });
    expect(expectOk(res.json())).toEqual({ who: 'by-name' });
  });

  it('matches by connector name when no request key matches', async () => {
    const mock = createMockClient(
      new Map<unknown, MockValue>([['api', mockResponse({ who: 'connector' })]]),
    );
    const res = await send(api, getUser('1'), { mockClient: mock });
    expect(expectOk(res.json())).toEqual({ who: 'connector' });
  });

  it('matches by URL pattern with a wildcard', async () => {
    const mock = createMockClient(
      new Map<unknown, MockValue>([
        ['https://api.example.com/users/*', mockResponse({ who: 'url' })],
      ]),
    );
    const res = await send(api, getUser('99'), { mockClient: mock });
    expect(expectOk(res.json())).toEqual({ who: 'url' });
  });

  it('falls back to the sequence in order', async () => {
    const mock = createMockClient([mockResponse({ n: 1 }), mockResponse({ n: 2 })]);
    const r1 = await send(api, getUser('1'), { mockClient: mock });
    const r2 = await send(api, getOrg('1'), { mockClient: mock });
    expect(expectOk(r1.json())).toEqual({ n: 1 });
    expect(expectOk(r2.json())).toEqual({ n: 2 });
  });

  it('keyed matches take priority over the sequence', async () => {
    const mock = createMockClient(
      new Map<unknown, MockValue>([['getUser', mockResponse({ keyed: true })]]),
    );
    mock.addResponse(mockResponse({ keyed: false }));
    const res = await send(api, getUser('1'), { mockClient: mock });
    expect(expectOk(res.json())).toEqual({ keyed: true });
  });

  it('throws a clear error when no mock is defined', async () => {
    const mock = createMockClient();
    const error = await send(api, getUser('1'), { mockClient: mock }).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('no response defined');
  });
});

describe('createMockClient — recording & assertions', () => {
  it('records sends and supports every assertion', async () => {
    const mock = createMockClient([mockResponse({ a: 1 }), mockResponse({ b: 2 })]);
    await send(api, getUser('1'), { mockClient: mock });
    await send(api, getOrg('2'), { mockClient: mock });

    expect(mock.getRecordedResponses()).toHaveLength(2);
    expect(mock.getLastRequest()?.name).toBe('getOrg');
    expect(mock.getLastPendingRequest()?.url).toBe('https://api.example.com/orgs/2');
    expect(mock.getLastResponse()?.status()).toBe(200);

    mock.assertSent(getUser); // factory
    mock.assertSent('getOrg'); // name
    mock.assertSent('https://api.example.com/users/*'); // url pattern
    mock.assertSentCount(2);
    mock.assertSentCount(1, getUser);
    mock.assertNotSent('getThing');
    mock.assertSentInOrder([getUser, getOrg]);
  });

  it('assertSent accepts a predicate of arity ≥ 2', async () => {
    const mock = createMockClient([mockResponse({}, 201)]);
    await send(api, getUser('1'), { mockClient: mock });

    mock.assertSent((_pending, response) => response.status() === 201);
    expect(() => mock.assertSent((_pending, response) => response.status() === 500)).toThrow();
  });

  it('assertSent throws when nothing matched', () => {
    const mock = createMockClient();
    expect(() => mock.assertSent('never')).toThrow(/none of the/);
  });

  it('assertNothingSent passes when fresh and throws after a send', async () => {
    const mock = createMockClient([mockResponse({})]);
    expect(() => mock.assertNothingSent()).not.toThrow();

    await send(api, getUser('1'), { mockClient: mock });
    expect(() => mock.assertNothingSent()).toThrow();
  });

  it('assertSentInOrder throws on the wrong order', async () => {
    const mock = createMockClient([mockResponse({}), mockResponse({})]);
    await send(api, getUser('1'), { mockClient: mock });
    await send(api, getOrg('1'), { mockClient: mock });
    expect(() => mock.assertSentInOrder([getOrg, getUser])).toThrow();
  });

  it('finds responses by request and by URL', async () => {
    const mock = createMockClient([mockResponse({ x: 1 }), mockResponse({ x: 2 })]);
    await send(api, getUser('1'), { mockClient: mock });
    await send(api, getUser('2'), { mockClient: mock });

    expect(expectOk(unwrap(mock.findResponseByRequest(getUser)).json())).toEqual({ x: 1 });
    expect(expectOk(unwrap(mock.findResponseByRequest(getUser, 1)).json())).toEqual({ x: 2 });
    expect(mock.findResponseByRequestUrl('https://api.example.com/users/2')).toBeDefined();
  });
});

describe('global mock client', () => {
  afterEach(() => destroyGlobalMockClient());

  it('is used by send() when set, and cleared by destroy', async () => {
    const mock = createMockClient([mockResponse({ global: true })]);
    setGlobalMockClient(mock);
    expect(getGlobalMockClient()).toBe(mock);

    const res = await send(api, getUser('1')); // no per-call mock client
    expect(expectOk(res.json())).toEqual({ global: true });

    destroyGlobalMockClient();
    expect(getGlobalMockClient()).toBeUndefined();
  });
});

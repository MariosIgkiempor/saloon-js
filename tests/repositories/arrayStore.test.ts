import { describe, expect, it } from 'vitest';
import { createArrayStore } from '@/repositories/arrayStore';

describe('createArrayStore', () => {
  it('is empty by default', () => {
    expect(createArrayStore().all()).toEqual({});
  });

  it('seeds from initial data', () => {
    expect(createArrayStore<string>({ a: '1', b: '2' }).all()).toEqual({ a: '1', b: '2' });
  });

  it('get reads a stored value', () => {
    expect(createArrayStore<string>({ a: '1' }).get('a')).toBe('1');
  });

  it('get falls back to the default for a missing key', () => {
    const store = createArrayStore<string>();
    expect(store.get('missing', 'fallback')).toBe('fallback');
    expect(store.get('missing')).toBeUndefined();
  });

  it('set replaces every entry', () => {
    const store = createArrayStore<string>({ a: '1' });
    store.set({ b: '2' });
    expect(store.all()).toEqual({ b: '2' });
  });

  it('merge lets later arrays win (array_merge precedence)', () => {
    const store = createArrayStore<string>({ a: '1', b: '2' });
    store.merge({ b: 'override', c: '3' }, { c: 'last' });
    expect(store.all()).toEqual({ a: '1', b: 'override', c: 'last' });
  });

  it('set and merge are chainable and return the same store', () => {
    const store = createArrayStore<string>();
    expect(store.set({ a: '1' }).merge({ b: '2' })).toBe(store);
    expect(store.all()).toEqual({ a: '1', b: '2' });
  });

  it('all() returns a snapshot that cannot mutate the store', () => {
    const store = createArrayStore<string>({ a: '1' });
    const snapshot = store.all();
    snapshot.a = 'mutated';
    expect(store.all()).toEqual({ a: '1' });
  });
});

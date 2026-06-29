import { describe, expect, it } from 'vitest';
import { createIntegerStore } from '@/repositories/integerStore';

describe('integerStore', () => {
  it('defaults to null and is empty', () => {
    const store = createIntegerStore();
    expect(store.get()).toBeNull();
    expect(store.isEmpty()).toBe(true);
    expect(store.isNotEmpty()).toBe(false);
  });

  it('sets and reads a value', () => {
    const store = createIntegerStore();
    expect(store.set(250).get()).toBe(250);
  });

  it('treats 0 as empty (PHP empty() semantics)', () => {
    const store = createIntegerStore(0);
    expect(store.get()).toBe(0);
    expect(store.isEmpty()).toBe(true);
    expect(store.isNotEmpty()).toBe(false);
  });

  it('treats a positive value as not empty', () => {
    const store = createIntegerStore(10);
    expect(store.isEmpty()).toBe(false);
    expect(store.isNotEmpty()).toBe(true);
  });

  it('set is chainable', () => {
    const store = createIntegerStore();
    expect(store.set(1).set(2).get()).toBe(2);
  });
});

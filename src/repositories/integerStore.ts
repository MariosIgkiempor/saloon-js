// Port of ../saloon/src/Repositories/IntegerStore.php
//
// A factory closing over a single `number | null`, mirroring PHP's IntegerStore.
// `isEmpty` follows PHP `empty()` semantics: both `null` and `0` count as empty
// (the same quirk `phpEmpty` encodes for bodies). Used for `pending.delay`.

export interface IntegerStore {
  /** Replace the held value. Chainable. */
  set(value: number | null): IntegerStore;
  /** The held value (`null` when unset). */
  get(): number | null;
  /** PHP `empty()`: `null` or `0` are both empty. */
  isEmpty(): boolean;
  /** The negation of `isEmpty()`. */
  isNotEmpty(): boolean;
}

export function createIntegerStore(value: number | null = null): IntegerStore {
  let current = value;

  const api: IntegerStore = {
    set(next) {
      current = next;
      return api;
    },
    get: () => current,
    isEmpty: () => current === null || current === 0,
    isNotEmpty: () => !api.isEmpty(),
  };

  return api;
}

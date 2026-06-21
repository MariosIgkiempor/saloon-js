// Port of ../saloon/src/Repositories/ArrayStore.php
//
// A factory closing over a private `Record<string, T>` rather than a class. Only
// the methods Slice 1 needs are present; `has`/`add`/`remove`/`isEmpty`/… are
// added by the slice that first uses each. The store is literal — header
// case-insensitivity is handled at the PendingRequest/FetchSender boundary, not
// here.

export interface ArrayStore<T = unknown> {
  /** A snapshot of every entry (a copy — mutating it never touches the store). */
  all(): Record<string, T>;
  /** Read a key, falling back to `defaultValue` when it is absent. */
  get(key: string, defaultValue?: T): T | undefined;
  /** Replace every entry. Chainable. */
  set(data: Record<string, T>): ArrayStore<T>;
  /** Set a single key (later wins on conflict). Chainable. */
  add(key: string, value: T): ArrayStore<T>;
  /** Merge arrays in, later arrays winning (like PHP `array_merge`). Chainable. */
  merge(...arrays: Record<string, T>[]): ArrayStore<T>;
}

export function createArrayStore<T = unknown>(data: Record<string, T> = {}): ArrayStore<T> {
  let store: Record<string, T> = { ...data };

  const api: ArrayStore<T> = {
    all: () => ({ ...store }),
    get: (key, defaultValue) => (Object.hasOwn(store, key) ? store[key] : defaultValue),
    set(newData) {
      store = { ...newData };
      return api;
    },
    add(key, value) {
      store[key] = value;
      return api;
    },
    merge(...arrays) {
      const next: Record<string, T> = { ...store };
      for (const entries of arrays) {
        Object.assign(next, entries);
      }
      store = next;
      return api;
    },
  };

  return api;
}

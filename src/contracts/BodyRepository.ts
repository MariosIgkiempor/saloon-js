// Port of ../saloon/src/Contracts/Body/BodyRepository.php
//
// The body contract, introduced in Slice 2. Each body type is a factory
// (`jsonBody`, `formBody`, …) returning a `BodyRepository` — a plain object
// closing over its data, mirroring the `createArrayStore` pattern. Methods return
// `BodyRepository<T>` (not `this`) to match the store convention from Slice 1.
//
// `kind` is a string discriminant that replaces PHP's "same class" identity check
// (`$connectorBody instanceof $requestBody`) in MergeBody.

/** The native body + the content type a body type wants (`null` = let fetch decide). */
export interface RequestBody {
  body: BodyInit;
  contentType: string | null;
}

export interface BodyRepository<T = unknown> {
  /** Discriminant for MergeBody's same-type enforcement (`'json'`, `'form'`, …). */
  readonly kind: string;
  /** Replace the body's data. Chainable. */
  set(value: T): BodyRepository<T>;
  /** The raw data (type varies by body type). */
  all(): T;
  /** PHP `empty()` semantics — see each body type for its quirks. */
  isEmpty(): boolean;
  /** An independent copy; merges/mutations never touch the original. */
  clone(): BodyRepository<T>;
  /** Materialize the native fetch body + the content type it implies. */
  toRequestBody(): RequestBody;
}

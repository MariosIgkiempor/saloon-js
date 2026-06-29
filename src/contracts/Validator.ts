// A request/connector `validator`: the single mechanism for casting + validating a
// response body into a typed value (it replaces the old `dto` cast hook). A
// validator is *either* a plain function or any Standard Schema (Zod/Valibot/…);
// `defineRequest` infers the response type from whichever you pass, and `send`
// runs it automatically against a successful response.

import type { StandardSchemaV1 } from '@/contracts/StandardSchema';

/**
 * A plain validator function. It receives the parsed body and returns the typed,
 * validated value, or signals failure by **throwing** (the thrown error is wrapped
 * in a `ValidationError`). May be async.
 */
export type ValidatorFn<T> = (data: unknown) => T | Promise<T>;

/** A validator: a function (throws on invalid) or any Standard Schema. */
export type Validator<T> = ValidatorFn<T> | StandardSchemaV1<unknown, T>;

/**
 * Infer the validated output type from a validator value — a Standard Schema's
 * output, or a function's (awaited) return type. `undefined`/absent → `unknown`,
 * preserving the untyped pass-through when no validator is defined.
 */
export type InferValidated<V> =
  V extends StandardSchemaV1<unknown, infer O>
    ? O
    : V extends (data: unknown) => infer R
      ? Awaited<R>
      : unknown;

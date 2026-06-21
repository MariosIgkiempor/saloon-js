// A tiny, dependency-free Result type — the library's internal error-handling
// primitive. Fallible internal operations are modeled as values (`ok`/`err`)
// rather than by throwing, so control flow stays explicit and composable.
//
// The one deliberate exception to "don't throw" is the network failure
// (`FatalRequestError`), which `send` throws so that `await` and `Promise.all`
// reject the way callers expect. See `.claude/plans/api-style.md` for the policy.
//
// Slice 3 promotes this to the public barrel: `response.toResult()` returns a
// `Result<Response, RequestError>`, so consumers need `isOk`/`isErr` (and the
// type) to discriminate the failure value without throwing.

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

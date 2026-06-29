# Validation

Attach a `validator` to a request (or connector) and saloon-js will:

1. **Infer** the response type from it — no explicit type argument, and
2. **Validate** the body automatically when you `send`, throwing a
   `ValidationError` if a successful response doesn't match.

A validator is **either** a plain function **or** any
[Standard Schema](https://standardschema.dev) — and saloon-js has **no
dependency** on any validation library.

## Two kinds of validator

### A function

It receives the parsed body (typed `unknown`) and returns the validated, typed
value — or **throws** to signal an invalid body. The return type becomes your
response type.

```ts
import { defineRequest, send, Method } from 'saloon-js';

interface User { id: string; email: string }

const getUser = (id: string) =>
  defineRequest({
    method: Method.GET,
    endpoint: `/users/${id}`,
    validator: (data): User => {
      const u = data as Record<string, unknown>;
      if (typeof u.id !== 'string' || typeof u.email !== 'string') {
        throw new Error('malformed user');
      }
      return { id: u.id, email: u.email };
    },
  });

const res = await send(api, getUser('1'));
res.dto().email; // string — inferred, no `defineRequest<User>` needed
```

### A Standard Schema (Zod, Valibot, ArkType, …)

[Standard Schema](https://standardschema.dev) is a small spec co-authored by the
Zod, Valibot, and ArkType maintainers: any conforming schema exposes a
`~standard` property. saloon-js accepts **any** of them and infers the output
type — without depending on the library you choose.

```ts
import { defineRequest, send, Method } from 'saloon-js';
import { z } from 'zod';           // ≥ 3.24 — or valibot ≥ 1.0, arktype ≥ 2.0, …

const User = z.object({ id: z.string(), email: z.string().email() });

const getUser = (id: string) =>
  defineRequest({ method: Method.GET, endpoint: `/users/${id}`, validator: User });

const res = await send(api, getUser('1'));
res.dto().email; // string — inferred from the schema
```

> **Bring your own validator.** saloon-js has no dependency on any validation
> library — it only knows the vendor-neutral `~standard` interface. Use whichever
> library you like, or a plain function; nothing is imported on your behalf.

## Reading the result

`send` validates a **successful** response automatically and throws on failure.
You can also read it off the response yourself:

| Accessor | Returns | On invalid |
| --- | --- | --- |
| `response.dto()` | `TDto` | **throws** `ValidationError` |
| `response.dtoOrFail()` | `TDto` | throws `RequestError` first if `failed()`, else as `dto()` |
| `response.validate()` | `Result<TDto, ValidationError>` | returns `err` (never throws) |
| `response.validateAsync()` | `Promise<Result<TDto, ValidationError>>` | returns `err` |

```ts
import { isOk } from 'saloon-js';

const r = response.validate();
if (isOk(r)) use(r.value); else console.error(r.error.issues);
```

The body is validated **at most once** and the result is memoized — `send`'s
eager check, `dto()`, and `validate()` all share it.

## Asynchronous validators

A Standard Schema may validate asynchronously (e.g. a Zod `.refine` that returns
a Promise). `send` awaits it for you. If you read the result yourself, use
`validateAsync()` — the synchronous `validate()` returns an `err` telling you to.

## When validation runs (and when it doesn't)

- Only **successful** responses are validated. A 4xx/5xx is a completed
  round-trip (see [Error handling](error-handling.md)); `send` returns it without
  validating, so you still inspect the error body. `dtoOrFail()` throws the
  `RequestError` for those.
- With **no validator** configured, `dto()`/`validate()` pass the parsed body
  through untyped (`unknown`).
- A request-level `validator` wins; a connector-level `validator` is the fallback
  for requests that define none.

## `ValidationError`

Thrown by `send` (and `dto()`) on an invalid body. It extends `SaloonError` and
carries:

- `issues: readonly StandardSchemaIssue[]` — `{ message, path? }` per problem
  (a thrown function-validator error becomes a single issue), and
- `value` — the body that failed.

```ts
import { isValidationError } from 'saloon-js';

try {
  await send(api, getUser('1'));
} catch (error) {
  if (isValidationError(error)) console.error(error.issues);
}
```

Next: [Error handling](error-handling.md).

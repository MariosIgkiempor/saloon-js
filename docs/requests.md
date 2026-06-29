# Requests

A request is one-per-endpoint config from `defineRequest`. Wrap it in your own
factory to accept parameters.

```ts
import { defineRequest, Method } from 'saloon-js';

const getUser = (id: string) =>
  defineRequest({ method: Method.GET, endpoint: `/users/${id}`, name: 'getUser' });

const searchUsers = (q: string) =>
  defineRequest({
    method: Method.GET,
    endpoint: '/users',
    query: { q, per_page: 20 },
  });
```

`Method` is an enum: `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`,
`OPTIONS`, `CONNECT`, `TRACE`.

## Dynamic endpoint

`endpoint` may be a function of the request:

```ts
defineRequest({ method: Method.GET, endpoint: (req) => `/users/${req.query.get('id')}` });
```

## Sending a body

Use a [body repository](request-body.md) for POST/PUT/PATCH:

```ts
import { jsonBody } from 'saloon-js';

const createUser = (name: string) =>
  defineRequest({
    method: Method.POST,
    endpoint: '/users',
    body: jsonBody({ name }),
  });
```

## Validation — typed results

Add a `validator` to a request and the response type is **inferred** from it —
no explicit type argument. `send` runs it automatically against a successful
response and throws a `ValidationError` if the body doesn't match; `response.dto()`
returns the validated, typed value.

A validator is **either** a plain function (it returns the typed value, or throws
on invalid) **or** any [Standard Schema](https://standardschema.dev) — Zod,
Valibot, ArkType, … (saloon-js has **no dependency** on any of them):

```ts
import { defineRequest, send, Method } from 'saloon-js';
import { z } from 'zod';

// 1) A Standard Schema (Zod here):
const User = z.object({ id: z.string(), email: z.string().email() });
const getUser = (id: string) =>
  defineRequest({ method: Method.GET, endpoint: `/users/${id}`, validator: User });

// 2) Or a plain function — `data` is typed `unknown`:
const getUserFn = (id: string) =>
  defineRequest({
    method: Method.GET,
    endpoint: `/users/${id}`,
    validator: (data): { id: string; email: string } => {
      const u = data as Record<string, unknown>;
      if (typeof u.id !== 'string') throw new Error('id must be a string');
      return { id: u.id, email: String(u.email) };
    },
  });

const res = await send(api, getUser('1')); // throws ValidationError if invalid
res.dto().email;    // string — inferred from the validator
```

See [Validation](validation.md) for the full surface (`validate()`,
`validateAsync()`, async schemas) and the Standard Schema rationale. A
connector-level `validator` is the fallback for any request that defines none.
With no validator, `dto()` returns the parsed body untyped (`unknown`).

## Per-call tweaks

`withX` transformers return a **new** request (the original is untouched) and
win over connector/request defaults. They also apply to connectors.

```ts
import { withHeaders, withQuery, withAuth, withBody, withConfig, tokenAuth } from 'saloon-js';

await send(connector, withHeaders(getUser('1'), { 'If-None-Match': etag }));
await send(connector, withQuery(searchUsers('ada'), { page: 2 }));
await send(connector, withAuth(getUser('1'), tokenAuth(otherToken)));
```

Available: `withHeaders`, `withQuery`, `withConfig`, `withBody`, `withAuth`,
`withMiddleware`.

## Override the base URL

Set `allowBaseUrlOverride: true` to let an absolute `endpoint` replace the
connector's base URL for that request.

Next: [Responses](responses.md).

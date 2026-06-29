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

## DTOs — typed results

Give `defineRequest` a `TDto` type parameter and a `dto` caster to turn a raw
response into a typed object. `response.dto()` runs the caster; `dtoOrFail()`
throws a `RequestError` first if the response `failed()`.

```ts
import { defineRequest, send, isOk, Method } from 'saloon-js';

interface User { id: string; email: string }

const getUser = (id: string) =>
  defineRequest<User>({
    method: Method.GET,
    endpoint: `/users/${id}`,
    dto: (res) => {
      const body = res.json<User>();
      if (!isOk(body)) throw body.error;
      return body.value;
    },
  });

const res = await send(api, getUser('1'));
res.dto().email;       // string — typed as User
res.dtoOrFail().id;    // same, but throws on a 4xx/5xx response
```

A connector-level `dto` acts as the fallback for any request that doesn't define
its own:

```ts
defineConnector({ baseUrl, dto: (res) => /* … */ });
```

When neither the request nor the connector defines a `dto`, `dto()` returns
`undefined`.

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

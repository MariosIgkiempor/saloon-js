# Getting started

## 1. Define a connector

One connector per API. It owns the base URL and anything shared across requests.

```ts
import { defineConnector } from 'saloon-js';

const connector = defineConnector({ baseUrl: 'https://api.example.com' });
```

## 2. Define a request

One request per endpoint. Wrap it in your own factory to take parameters.

```ts
import { defineRequest, Method } from 'saloon-js';

const getUser = (id: string) =>
  defineRequest({ method: Method.GET, endpoint: `/users/${id}` });
```

## 3. Send it

`send` is a free function returning a `Promise<Response>`.

```ts
import { send } from 'saloon-js';

const response = await send(connector, getUser('42'));

response.status();        // 200
response.json();          // Result<unknown, SyntaxError>  (never throws)
response.successful();    // true for 2xx
```

A 4xx/5xx is **still a successful round-trip** — it does not throw. See
[Error handling](error-handling.md).

## Reuse a connector with `send.with`

```ts
const api = send.with(connector);

await api(getUser('1'));
await api(getUser('2'));
```

## Read the body

`json()` parses lazily and returns a `Result` — malformed JSON gives an `err`
instead of throwing. Type it with a generic and unwrap with `isOk`:

```ts
import { isOk } from 'saloon-js';

interface User { id: string; name: string }

const body = response.json<User>();   // Result<User, SyntaxError>
if (isOk(body)) console.log(body.value.name);

// Or read a single dot-path with a fallback (always returns a value):
const name = response.json<string>('name', 'anonymous');
```

See [Responses](responses.md) for the full reading surface.

Next: [Connectors](connectors.md).

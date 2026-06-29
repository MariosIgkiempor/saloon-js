# Connectors

A connector is one-per-API config produced by `defineConnector`. It returns a
frozen, reusable value (no class). Every field except `baseUrl` is optional.

```ts
import { defineConnector, tokenAuth, acceptsJson, Method } from 'saloon-js';

const connector = defineConnector({
  baseUrl: 'https://api.example.com',
  headers: { 'X-App': 'demo' },        // default headers, merged into every request
  query: { version: '2' },             // default query params
  auth: tokenAuth(process.env.TOKEN!), // default authenticator
  plugins: [acceptsJson()],            // run on every send
  name: 'example',                     // used by mock matching (see Testing)
});
```

## Dynamic base URL

`baseUrl` may be a function, resolved per send:

```ts
defineConnector({ baseUrl: () => process.env.API_URL ?? 'https://api.example.com' });
```

## Shared lifecycle hooks

```ts
defineConnector({
  baseUrl: 'https://api.example.com',
  // Mutate every pending request just before it is sent.
  boot: (pending) => pending.headers.add('X-Request-Id', crypto.randomUUID()),
  // Last word over the native fetch init.
  handleFetchRequest: (init) => ({ ...init, keepalive: true }),
});
```

## Precedence

When a value is set in more than one place, the **more specific wins**:

```
per-call withX  >  request  >  connector
```

So a default header on the connector is overridden by the same header on the
request, which is overridden by [`withHeaders`](requests.md#per-call-tweaks) at
the call site.

See also: [Authentication](authentication.md), [Plugins](plugins.md).

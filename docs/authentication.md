# Authentication

Authenticators are factory functions. Set one on the connector (applies to every
request), on a request, or per-call with `withAuth`.

```ts
import { defineConnector, tokenAuth } from 'saloon-js';

const connector = defineConnector({
  baseUrl: 'https://api.example.com',
  auth: tokenAuth(process.env.TOKEN!),
});
```

## Built-in authenticators

```ts
import { tokenAuth, basicAuth, headerAuth, queryAuth, multiAuth } from 'saloon-js';

tokenAuth('abc');                 // Authorization: Bearer abc
tokenAuth('abc', 'Token');        // Authorization: Token abc
basicAuth('user', 'pass');        // Authorization: Basic base64(user:pass)
headerAuth('abc', 'X-Api-Key');   // X-Api-Key: abc   (default header: Authorization)
queryAuth('api_key', 'abc');      // ?api_key=abc
multiAuth(headerAuth('a', 'X-A'), queryAuth('k', 'v')); // apply several in order
```

## Per-call and lazy auth

```ts
import { withAuth } from 'saloon-js';

// Override for a single call:
await send(connector, withAuth(getUser('1'), tokenAuth(scopedToken)));

// Resolve the authenticator lazily (e.g. read a freshly-rotated token):
defineConnector({ baseUrl, auth: () => tokenAuth(loadToken()) });
```

Request auth beats connector auth; `withAuth` beats both.

## Custom authenticator

An authenticator is any object with a `set(pending)` method:

```ts
const dateAuth: Authenticator = {
  set: (pending) => pending.headers.add('X-Date', new Date().toUTCString()),
};
```

# Plugins

A plugin is an object with a `boot(pending)` hook that runs on every send. Add
them via the `plugins` array on a connector or request.

```ts
import { defineConnector, acceptsJson, hasTimeout, alwaysThrowOnErrors } from 'saloon-js';

const connector = defineConnector({
  baseUrl: 'https://api.example.com',
  plugins: [acceptsJson(), hasTimeout({ request: 5000 })],
});
```

## Built-in plugins

```ts
acceptsJson();                          // sends Accept: application/json
hasTimeout({ connect: 2000, request: 5000 }); // timeouts in MILLISECONDS
alwaysThrowOnErrors();                  // turn any 4xx/5xx into a thrown RequestError
```

`hasTimeout` values are milliseconds (JS convention), not seconds. Both fields
are optional.

`alwaysThrowOnErrors` registers a response pipe (ordered last) that calls
`response.throw()` — opt in to exception-style handling instead of the default
return-based errors. See [Error handling](error-handling.md).

## Custom plugin

```ts
import type { Plugin } from 'saloon-js';

const withTracing = (): Plugin => ({
  boot: (pending) => pending.headers.add('traceparent', newTraceId()),
});

defineConnector({ baseUrl, plugins: [withTracing()] });
```

## Ad-hoc middleware

For one-off request/response interception without a plugin, use `withMiddleware`:

```ts
import { withMiddleware } from 'saloon-js';

const traced = withMiddleware(getUser('1'), (pipeline) => {
  pipeline.onRequest((pending) => { /* inspect/mutate */ });
  pipeline.onResponse((res) => res);
});
```

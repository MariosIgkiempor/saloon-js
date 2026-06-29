# Responses

`send` resolves to a `Response`. A 4xx/5xx is a *successful round-trip* — reading
a response never throws (the one exception is `.throw()`, which you opt into).

## Status

```ts
response.status();      // number, e.g. 200
response.ok();          // status === 200
response.successful();  // 200–299
response.redirect();    // 300–399
response.clientError(); // 400–499
response.serverError(); // ≥ 500
response.failed();      // ≥ 400  (clientError || serverError)
```

## Body

```ts
response.body();              // raw text (buffered once)

// Whole body as JSON — a Result, so malformed JSON is err, never a throw:
const r = response.json<User>();      // Result<User, SyntaxError>
if (isOk(r)) use(r.value);

// Dot-path read with a fallback — returns a value directly:
const name = response.json<string>('user.name', 'anonymous');

response.object<User>();      // Result<User, SyntaxError> (parity with PHP object())
```

## Headers

```ts
response.header('content-type');  // string | undefined (case-insensitive)
response.headers().all();         // Record<string, string>
```

## Failure as a value or a throw

```ts
import { isErr } from 'saloon-js';

// As a Result — pattern-match the failure without try/catch:
const result = response.toResult(); // Result<Response, RequestError>
if (isErr(result)) console.error(result.error.status);

// Run a side effect only on failure (chainable):
response.onError((res) => console.warn('failed', res.status()));

// Opt in to throwing:
response.throw(); // throws RequestError when failed(), else returns the response
```

See [Error handling](error-handling.md) for the error types and predicates.

## Validated body

When the request (or connector) defines a [`validator`](requests.md#validation--typed-results),
`send` validates a successful response automatically. You can also read the
result off the response:

```ts
import { isOk } from 'saloon-js';

response.dto();             // the validated value (throws ValidationError if invalid)
response.dtoOrFail();       // throws RequestError first if failed(), else dto()

// Return-based (never throws):
const r = response.validate();        // Result<TDto, ValidationError>
if (isOk(r)) use(r.value);

// For asynchronous schemas (a validator whose validate returns a Promise):
const ra = await response.validateAsync();
```

With no validator configured, `validate()`/`dto()` pass the parsed body through
untyped (`unknown`). See [Validation](validation.md) for details.

## Escape hatches

```ts
response.getFetchResponse();  // the underlying native fetch Response
response.getRequest();        // the Request that produced it
response.getConnector();
response.isMocked();          // true when served by a mock/fixture
```

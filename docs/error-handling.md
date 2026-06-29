# Error handling

saloon-js is **return-based** by default: a 4xx/5xx is a completed round-trip, so
`send` resolves normally and nothing is thrown. You decide how to surface it.

The only thing that *throws* from `send` is a transport failure (DNS, connection
refused, timeout) — a `FatalRequestError`.

## Inspect the response

```ts
const response = await send(connector, getUser('1'));

if (response.failed()) {
  console.error('HTTP', response.status());
}
```

## As a `Result`

```ts
import { isErr } from 'saloon-js';

const result = response.toResult(); // Result<Response, RequestError>
if (isErr(result)) {
  const error = result.error;       // RequestError
  console.error(error.status, error.message);
}
```

## Opt in to throwing

```ts
// Per response:
response.throw(); // throws RequestError when failed(), else returns the response

// Or for every request via a plugin:
defineConnector({ baseUrl, plugins: [alwaysThrowOnErrors()] });
```

## Catching transport failures

```ts
import { isFatalRequestError } from 'saloon-js';

try {
  await send(connector, getUser('1'));
} catch (error) {
  if (isFatalRequestError(error)) console.error('network failed:', error.message);
}
```

## Error predicates

Prefer predicates over `instanceof`. They key off a `kind` discriminant rather
than a subclass per status.

```ts
import {
  isSaloonError, isFatalRequestError, isRequestError,
  isClientError, isServerError,
  isUnauthorizedError, isForbiddenError, isNotFoundError,
  isTooManyRequestsError, isUnprocessableEntityError, isRequestTimeoutError,
  isPaymentRequiredError, isMethodNotAllowedError,
  isInternalServerError, isServiceUnavailableError, isGatewayTimeoutError,
} from 'saloon-js';

if (isNotFoundError(error))      { /* 404 */ }
else if (isClientError(error))   { /* any other 4xx */ }
else if (isServerError(error))   { /* any 5xx */ }
```

`isClientError` (any 4xx) and `isServerError` (any 5xx) are the broad fallbacks;
the named predicates match a specific status. All `RequestError`s carry
`.status` (number) and `.kind`.

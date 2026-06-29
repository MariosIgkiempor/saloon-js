# Request body

Bodies are factory functions returning a body repository. Set one via the `body`
field on a request (or connector), or per-call with `withBody`. The right
`Content-Type` is set automatically unless you override it with a header.

## JSON

```ts
import { jsonBody } from 'saloon-js';

defineRequest({ method: Method.POST, endpoint: '/users', body: jsonBody({ name: 'Ada' }) });
// → Content-Type: application/json
```

`jsonBody` and `formBody` are *mergeable*: a later/request value wins per key
(`array_merge` semantics). Note `isEmpty` follows PHP — `{ count: 0 }` is **not**
empty (it has a key), but `{}` is.

## Form (urlencoded)

```ts
import { formBody } from 'saloon-js';

formBody({ grant_type: 'client_credentials', scope: 'read' });
// → Content-Type: application/x-www-form-urlencoded
```

## Multipart

```ts
import { multipartBody } from 'saloon-js';

const body = multipartBody()
  .add('field', 'value')
  .add('file', fileBlob, 'avatar.png'); // (name, contents, filename?)
// fetch sets multipart/form-data; boundary=… itself
```

## String & stream

```ts
import { stringBody, streamBody } from 'saloon-js';

stringBody('raw text', 'text/plain');        // value, optional contentType
streamBody(readableStreamOrBlob, 'application/octet-stream');
```

## Lazy body

`body` may be a thunk, resolved per send:

```ts
defineRequest({ method: Method.POST, endpoint: '/upload', body: () => streamBody(openStream()) });
```

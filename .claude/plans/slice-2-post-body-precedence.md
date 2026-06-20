# Slice 2 — POST, body types, and precedence

> **API style:** functional, no classes — see `api-style.md`. Body repos are
> **factory functions** returning `BodyRepository` objects; per-call tweaks are
> **immutable transformers** (`withHeaders`/`withBody`/…), never mutation.

## Goal
Send a **POST with a body** end-to-end and lock down the full
connector→request **precedence** model. After this slice the library can do real
writes with correct `Content-Type` and merged headers/query/config, and users can
tweak any connector/request per call with the `withX` transformers.

## Example (consumer API)
```ts
import {
  defineConnector, defineRequest, send, Method,
  jsonBody, formBody, multipartBody, stringBody,
  withHeaders, withQuery, withBody,
} from 'saloon-js';

const api = defineConnector({ baseUrl: 'https://httpbin.org', headers: { 'X-App': 'demo' } });

// Body type drives Content-Type automatically.
const createUser = (name: string) =>
  defineRequest({ method: Method.POST, endpoint: '/post', body: jsonBody({ name }) });

await send(api, createUser('Ada'));                         // Content-Type: application/json
await send(api, defineRequest({                             // application/x-www-form-urlencoded
  method: Method.POST, endpoint: '/post', body: formBody({ a: '1', b: '2' }),
}));
await send(api, defineRequest({                             // multipart/form-data; boundary=…
  method: Method.POST, endpoint: '/post',
  body: multipartBody([{ name: 'file', value: new Blob(['hi']), filename: 'hi.txt' }]),
}));
await send(api, defineRequest({ method: Method.POST, endpoint: '/post', body: stringBody('raw', 'text/plain') }));

// Precedence: request wins over connector; withX wins over both — no subclassing.
await send(api, withHeaders(createUser('Ada'), { 'X-App': 'override' }));
await send(api, withQuery(createUser('Ada'), { dryRun: true }));
await send(api, withBody(createUser('Ada'), jsonBody({ name: 'Grace' })));
```

## Files

### Body repositories `src/repositories/body/`
Each a **factory** returning a `BodyRepository` (closure over the data); a `kind`
string discriminant replaces PHP's "same constructor" identity checks.
- `jsonBody(obj)` (mergeable) → `{ body: JSON.stringify(data), contentType: 'application/json' }`
- `formBody(obj)` (mergeable) → `{ body: new URLSearchParams(data), contentType: 'application/x-www-form-urlencoded' }`
- `multipartBody(values)` (mergeable) — stores `MultipartValue[] = { name, value: string|Blob, filename?, headers? }`;
  `toRequestBody` builds `FormData`, returns `{ body: form, contentType: null }`;
  exposes `add(name, contents, filename?, headers?)`, `attach(value)`
- `stringBody(str, contentType?)` — raw string + explicit content type
- `streamBody(stream, contentType?)` — wraps `ReadableStream`/`Blob` for upload

### Contracts (add the body contract — not defined until now)
- `BodyRepository.ts`: `interface BodyRepository<T = unknown> { set(v): this; all(): T; isEmpty(): boolean; clone(): BodyRepository<T>; kind: string; toRequestBody(): { body: BodyInit; contentType: string | null }; }`
- `MergeableBody.ts`: `interface MergeableBody { merge(value: unknown): this; }`

### Array store grows
- Add `has(key)` to `createArrayStore` — first used here by `createFetchRequest`'s
  "Content-Type not already set by a header" check.

### Config + normalized values grow
- Add `body?` and `config?` (the misc per-request options bag) to `ConnectorConfig`
  / `RequestConfig` (value or thunk). Add `body`/`config` stores to the normalized
  `Connector`/`Request` values.

### Immutable transformers `src/http/transformers.ts`
Each returns a **new frozen value**, never mutates; generic over `Connector | Request`:
- `withHeaders(target, patch)`, `withQuery(target, patch)`, `withConfig(target, patch)`
- `withBody(target, body)`
- (`withAuth`/`withMiddleware` are added in Slice 4, when the `auth`/`middleware`
  fields they operate on are introduced.)

### PendingRequest grows a tap list
Introduce the explicit tap sequence the rest of the slices extend (still no full
middleware pipeline — that's Slice 4). Taps are plain `(pending) => void`:
- `src/http/pending/mergeRequestProperties.ts` — merge headers/query/config
  (connector then request; request wins) into pending's stores.
- `src/http/pending/mergeBody.ts` — clone connector/request bodies; **enforce same
  `kind`** (throw on mismatch); request wins; if both `MergeableBody`,
  `connectorBody.merge(requestBody.all())`; `pending.setBody(...)`.
- `pendingRequest` runs `mergeRequestProperties → mergeBody` (auth/plugins/boot
  added in later slices), then continues to `createFetchRequest`.

### `createFetchRequest` body handling
In `pendingRequest.createFetchRequest()`:
- if `body` && not empty → `toRequestBody()`; set `init.body`; set `Content-Type`
  if returned non-null **and** not already set by a header.
- if `contentType === null` (multipart) → **remove** any Content-Type so fetch
  sets the boundary itself.

## Tests (`tests/`)
- `tests/http/postBody.test.ts` (live server echo):
  - POST `jsonBody` → server receives `application/json` + correct JSON.
  - POST `formBody` → correct urlencoded payload + content type.
  - `multipartBody` → boundary present, no manual Content-Type, fields received.
  - `stringBody` → raw body + explicit content type.
- `tests/http/precedence.test.ts`:
  - header merge precedence (request overrides connector; `withHeaders` overrides both).
  - query merge precedence (connector + request; store wins over inline URL query).
  - config merge precedence.
- `tests/repositories/body.test.ts`: mergeable bodies merge connector→request;
  same-`kind` enforcement throws on mismatch; `clone` is independent.

## Done criteria
- Real POST with each body type passes against the local server (echo-verified).
- Precedence (headers/query/config) verified by server echo + transformers.
- Same-`kind` body enforcement covered.
- typecheck + lint + build clean; tests green.

## Reference
- `../saloon/src/Repositories/Body/*.php`, `../saloon/src/Data/MultipartValue.php`
- `../saloon/src/Contracts/Body/{BodyRepository,MergeableBody}.php`
- `../saloon/src/Http/PendingRequest/MergeBody.php`,
  `../saloon/src/Http/PendingRequest/MergeRequestProperties.php`

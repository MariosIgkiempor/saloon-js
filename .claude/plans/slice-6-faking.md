# Slice 6 — Faking (mocking & fixtures)

> **API style:** functional, no classes — see `api-style.md`. `createMockClient`,
> `mockResponse`, and `fixture` are **factories**. With no request/connector
> *classes*, "match this request type" keys off the request's **identity / `name`**
> (stamped by `defineRequest`/`defineConnector`), not `instanceof`.

## Goal
First-class testing support: `createMockClient`, `mockResponse`/`FakeResponse`,
request recording + assertions, and disk fixtures with redaction. This slice also
**introduces** the fake-response path in `send`/`pendingRequest` (it had no reason
to exist before now), so the library's own suite can run against mocked transport.

## Example (consumer API)
```ts
import { createMockClient, mockResponse, fixture, send } from 'saloon-js';

// Match in priority order: by request factory → connector → URL pattern → sequence.
const mock = createMockClient();
mock.addResponses(new Map<unknown, unknown>([
  [getUser, mockResponse({ id: '1', name: 'Ada' })],          // by request factory identity
  ['https://api.example.com/orgs/*', mockResponse({}, 404)],  // URL pattern (wildcard)
]));

const res = await send(api, getUser('ada'), { mockClient: mock });
res.isMocked();   // true
res.json();       // { id: '1', name: 'Ada' }

// Framework-agnostic assertions (throw plain Errors with clear messages).
mock.assertSent(getUser);
mock.assertSentCount(1);
mock.assertNotSent('https://api.example.com/admin/*');

// Errors:
mock.addResponse(mockResponse({ message: 'nope' }, 500).throw());

// Fixtures: record live once to disk, replay (offline) thereafter.
const recorded = createMockClient([fixture('users/ada', { sensitiveHeaders: ['authorization'] })]);
await send(api, getUser('ada'), { mockClient: recorded });

// Or set a global mock for a whole test file:
// setGlobalMockClient(mock); … destroyGlobalMockClient();
```

## Files (`src/faking/`)

### `fakeResponse.ts` / `mockResponse.ts`
Port of `FakeResponse.php`/`MockResponse.php`, as factories.
- `mockResponse(body = {}, status = 200, headers = {})` — object body → JSON repo;
  string → string repo. Returns a `FakeResponse`.
- methods: `body(): BodyRepository`, `status(): number`, `headers(): ArrayStore`
- `throw(errorOrFactory)` → marks the fake to produce an error; `getError(pending)`
- `toResponse(pending)` — build a real `Response` (construct `globalThis.Response`,
  pass through `responseFromFetch`, mark `isMocked = true`).
- `FakeResponse.ts` contract: `status()`, `headers()`, `body()`, `getError?(pending)`.

### `mockClient.ts`
Port of `MockClient.php`, as `createMockClient(mockData?)`. Matching layers, in
priority order:
1. per-request: key = a **request factory function** or a request `name` string
2. per-connector: key = a **connector factory function** or connector `name`
3. URL pattern: string key vs the pending URL (`*` wildcard like PHP)
4. sequence: array fallback, consumed in order
- returns an object with: `addResponses(map|array)`, `addResponse(response, captureMethod?)`,
  `guessNextResponse(pending): FakeResponse | Fixture`
- recording: `recordResponse`, `getRecordedResponses`, `getLastRequest`,
  `getLastPendingRequest`, `getLastResponse`
- assertions (throw plain `Error` with clear messages — framework-agnostic):
  `assertSent(factoryOrNameOrUrlOrFn)`, `assertNotSent`, `assertSentCount(n, factoryOrName?)`,
  `assertNothingSent`, `assertSentInOrder([...])`
- finders: `findResponseByRequest(factoryOrName, index?)`, `findResponseByRequestUrl(url, index?)`
- globals (free functions): `setGlobalMockClient`, `getGlobalMockClient`,
  `destroyGlobalMockClient`.

> **Identity tagging:** `defineRequest`/`defineConnector` stamp each result with a
> non-enumerable link back to its factory (and/or `name`). `createMockClient` keys a
> `Map<Function | string, …>` on that ref or `name`; a string that isn't a known
> factory/name is treated as a URL pattern. Replaces PHP `::class` keys. (Add the
> stamping to `defineRequest`/`defineConnector` in this slice.)

### Fake-response wiring (introduced here — first reason to exist)
Add the pieces the mock path needs, none of which existed before:
- `pendingRequest`: the `mockClient` resolution (`options.mockClient ??
  request.mockClient ?? connector.mockClient ?? global`), `mockClient?` fields on the
  connector/request config + normalized values, the global mock slot in `config.ts`,
  and `hasFakeResponse()`/`getFakeResponse()`/`setFakeResponse()` on the pending
  object. Register the `determineMockResponse` middleware in the request pipeline.
- `send`: add the fake branch `pending.hasFakeResponse() ? await
  createFakeResponse(pending) : await connector.sender.send(pending)` (the branch the
  Slice-5 loop deliberately omitted).
- `response.ts`: add the `isMocked()`/`isCached()` flags (set true on mocked/cached
  responses) — first consumers are here.

### `src/http/middleware/determineMockResponse.ts`
If a mock client is present, `guessNextResponse(pending)` → resolve `Fixture` (load,
or fall through in record mode) → `pending.setFakeResponse(...)`. The
`createFakeResponse(pending)` helper turns it into a `Response`; the mock client
records it.

### `fixture.ts`
Port of `Fixture.php`, as `fixture(name, options?)`.
- `getFixturePath()` — sanitize name (alphanumeric + `-_/`), prevent traversal;
  default dir e.g. `tests/Fixtures/saloon`.
- `getMockResponse()` — load from disk or null.
- record/replay: file exists → replay; else the real request runs and the response
  is stored.
- redaction via **options/callbacks** (was subclass overrides): `sensitiveHeaders?`,
  `sensitiveJsonParameters?`, `sensitiveRegexPatterns?`, `beforeSave?(recorded)`.
- on-disk schema: JSON `{ statusCode, headers, data }` (+ context) — document it.

### `src/http/middleware/recordFixture.ts`
On response, if the pending used a fixture in record mode and none existed, persist
the recorded response.

## Tests (`tests/faking/`)
- `mockClient.test.ts`: per-request (factory + `name`), per-connector, URL-pattern,
  sequence matching + priority order; recording + every assertion (`assertSent` by
  factory/name/url/closure, `assertNotSent`, `assertSentCount` global + per-factory,
  `assertNothingSent`, `assertSentInOrder`); global set/get/destroy.
- `mockResponse.test.ts`: body/status/headers; `throw()` makes `send()` reject /
  `.throw()` produce the error; mocked response `isMocked()` true.
- `fixture.test.ts`: record to a temp dir then replay (no live HTTP second time);
  path-traversal rejected; sensitive header/json/regex redaction applied to stored bytes.
- **Retrofit**: migrate earlier slices' integration tests to `MockClient` where a
  live server isn't essential (keep a couple of genuine live-server tests).

## Done criteria
- All matching layers + assertions covered.
- Fixture record→replay round-trips through disk; redaction verified on stored bytes.
- Mocked responses flagged; recorded history accurate.
- typecheck + lint + build clean.

## Reference
- `../saloon/src/Http/Faking/{MockClient,FakeResponse,MockResponse,Fixture}.php`
- `../saloon/src/Http/Middleware/DetermineMockResponse.php`
- `../saloon/src/Data/RecordedResponse.php`

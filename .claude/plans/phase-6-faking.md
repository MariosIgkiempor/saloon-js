# Phase 6 — Faking (mocking & fixtures)

## Goal
First-class testing support: `MockClient`, `MockResponse`/`FakeResponse`, request recording + assertions, and disk fixtures with sensitive-data redaction. After this, the library's own test suite can run fully against mocked transport.

## Files (`src/faking/`)

### `FakeResponse.ts` / `MockResponse.ts`
Port of `saloon/src/Http/Faking/{FakeResponse,MockResponse}.php`.
- `MockResponse.make(body = {}, status = 200, headers = {})` — body array → JSON repo; string → string repo.
- `body(): BodyRepository`, `status(): number`, `headers(): ArrayStore`
- `throw(errorOrFactory)` → marks the fake to produce an exception; `getException(pending)`
- `static fixture(name): Fixture`
- `toResponse(pending)` — build a real `Response` from the fake (construct a `globalThis.Response` and pass through `Response.fromFetchResponse`, marking `isMocked = true`).

### `MockClient.ts`
Port of `saloon/src/Http/Faking/MockClient.php`. Matching layers in priority order:
1. per-request: key = Request **constructor reference**, `request.constructor === key` (or `instanceof`)
2. per-connector: key = Connector constructor reference
3. URL pattern: string key matched against the pending URL (support `*` wildcard like PHP)
4. sequence: array fallback, consumed in order
- `constructor(mockData?)`, `addResponses(map|array)`, `addResponse(response, captureMethod?)`
- `guessNextResponse(pending): MockResponse | Fixture`
- recording: `recordResponse(response)`, `getRecordedResponses()`, `getLastRequest()`, `getLastPendingRequest()`, `getLastResponse()`
- assertions (throw plain `Error` with clear messages — framework-agnostic, work in vitest/jest): `assertSent(classOrUrlOrFn)`, `assertNotSent(...)`, `assertSentCount(n, requestClass?)`, `assertNothingSent()`, `assertSentInOrder([...])`
- finders: `findResponseByRequest(RequestClass, index?)`, `findResponseByRequestUrl(url, index?)`
- global: `static global(mockData?)`, `static getGlobal()`, `static destroyGlobal()`

> Map keys: use a real `Map<Function | string, ...>`. Discriminate a class key by `key.prototype instanceof Request || key.prototype instanceof Connector`; otherwise treat string as URL pattern. No `::class` needed.

### `src/http/middleware/determineMockResponse.ts` (now real)
Replaces the Phase 3 stub. If a mock client is present, `guessNextResponse(pending)` → resolve `Fixture` (load or, in record mode, fall through) → set `pending.setFakeResponse(...)`. Connector's `createFakeResponse(pending)` turns it into a `Response` and the mock client records it.

### `Fixture.ts`
Port of `saloon/src/Http/Faking/Fixture.php`.
- `constructor(name, storage?, context?)`
- `getFixturePath()` — sanitize name (alphanumeric + `-_/`), prevent path traversal; default dir e.g. `tests/Fixtures/saloon`
- `getMockResponse()` — load from disk or null
- record/replay: if file exists → replay; else the real request runs and the response is stored (`store(recorded)`)
- redaction hooks (override in subclass): `defineSensitiveHeaders()`, `defineSensitiveJsonParameters()`, `defineSensitiveRegexPatterns()`, `beforeSave(recorded)`
- serialization format: JSON file with `{ statusCode, headers, data }` (+ context). Decide a stable on-disk schema and document it.

### `src/http/middleware/recordFixture.ts`
On response, if the pending request used a fixture in record mode and none existed, persist the recorded response.

## Tests (`tests/faking/`)
- `mockClient.test.ts`: per-request, per-connector, URL-pattern, and sequence matching each resolve correctly + priority order; recording + every assertion (`assertSent` by class/url/closure, `assertNotSent`, `assertSentCount` global + per-class, `assertNothingSent`, `assertSentInOrder`); global mock set/get/destroy.
- `mockResponse.test.ts`: body/status/headers; `throw()` makes `send()` reject/`.throw()` produce the error; mocked response `isMocked()` true.
- `fixture.test.ts`: record to a temp dir then replay (no live HTTP second time); path-traversal rejected; sensitive header/json/regex redaction applied to stored file.
- **Retrofit**: migrate prior phases' integration tests to use `MockClient` where a live server isn't essential.

## Done criteria
- All matching layers + assertions covered.
- Fixture record→replay round-trips through disk; redaction verified on stored bytes.
- Mocked responses flagged; recorded history accurate.

## Reference
- `saloon/src/Http/Faking/{MockClient,FakeResponse,MockResponse,Fixture}.php`
- `saloon/src/Http/Middleware/DetermineMockResponse.php`
- `saloon/src/Data/RecordedResponse.php`

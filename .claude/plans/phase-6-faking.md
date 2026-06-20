# Phase 6 — Faking (mocking & fixtures)

> **API style:** functional, no classes — see `api-style.md`. `createMockClient`,
> `mockResponse`, and `fixture` are **factories**. There are no request/connector
> *classes* to key matching off, so "match this request type" keys off the
> request's **identity / `name`** (see below) instead of `instanceof`.

## Goal
First-class testing support: `createMockClient`, `mockResponse`/`FakeResponse`, request recording + assertions, and disk fixtures with sensitive-data redaction. After this, the library's own test suite can run fully against mocked transport.

## Files (`src/faking/`)

### `fakeResponse.ts` / `mockResponse.ts`
Port of `../saloon/src/Http/Faking/{FakeResponse,MockResponse}.php`, as factories.
- `mockResponse(body = {}, status = 200, headers = {})` — body object → JSON repo; string → string repo. Returns a `FakeResponse` object.
- methods on the object: `body(): BodyRepository`, `status(): number`, `headers(): ArrayStore`
- `throw(errorOrFactory)` → marks the fake to produce an error; `getError(pending)`
- `toResponse(pending)` — build a real `Response` from the fake (construct a `globalThis.Response` and pass through `responseFromFetch`, marking `isMocked = true`).
- `fixture(name)` is its own factory (below), not a static.

### `mockClient.ts`
Port of `../saloon/src/Http/Faking/MockClient.php`, as `createMockClient(mockData?)`. Matching layers in priority order:
1. per-request: key = a **request factory function** or a request `name` string; match when the pending request was built from that factory / carries that `name`
2. per-connector: key = a **connector factory function** or connector `name`
3. URL pattern: string key matched against the pending URL (support `*` wildcard like PHP)
4. sequence: array fallback, consumed in order
- `createMockClient(mockData?)` returns an object with: `addResponses(map|array)`, `addResponse(response, captureMethod?)`
- `guessNextResponse(pending): FakeResponse | Fixture`
- recording: `recordResponse(response)`, `getRecordedResponses()`, `getLastRequest()`, `getLastPendingRequest()`, `getLastResponse()`
- assertions (methods that throw a plain `Error` with clear messages — framework-agnostic, work in vitest/jest): `assertSent(factoryOrNameOrUrlOrFn)`, `assertNotSent(...)`, `assertSentCount(n, factoryOrName?)`, `assertNothingSent()`, `assertSentInOrder([...])`
- finders: `findResponseByRequest(factoryOrName, index?)`, `findResponseByRequestUrl(url, index?)`
- global helpers (free functions, not statics): `setGlobalMockClient(mockData?)`, `getGlobalMockClient()`, `destroyGlobalMockClient()`

> Identity tagging: since requests are plain values, `defineRequest` stamps each result with a non-enumerable link back to its factory (and/or the `name` field). `createMockClient` keys a `Map<Function | string, ...>` on that factory ref or `name`; a string that isn't a known factory/name is treated as a URL pattern. This replaces PHP's `::class` keys.

### `src/http/middleware/determineMockResponse.ts` (now real)
Replaces the Phase 3 stub. If a mock client is present, `guessNextResponse(pending)` → resolve `Fixture` (load or, in record mode, fall through) → set `pending.setFakeResponse(...)`. The `createFakeResponse(pending)` helper (used by `send`) turns it into a `Response` and the mock client records it.

### `fixture.ts`
Port of `../saloon/src/Http/Faking/Fixture.php`, as `fixture(name, options?)`.
- `fixture(name, { storage?, context?, ...redaction } = {})` returns a `Fixture` object.
- `getFixturePath()` — sanitize name (alphanumeric + `-_/`), prevent path traversal; default dir e.g. `tests/Fixtures/saloon`
- `getMockResponse()` — load from disk or null
- record/replay: if file exists → replay; else the real request runs and the response is stored (`store(recorded)`)
- redaction hooks are **options/callbacks** passed to `fixture(...)` (was subclass overrides): `sensitiveHeaders?`, `sensitiveJsonParameters?`, `sensitiveRegexPatterns?`, `beforeSave?: (recorded) => recorded`
- serialization format: JSON file with `{ statusCode, headers, data }` (+ context). Decide a stable on-disk schema and document it.

### `src/http/middleware/recordFixture.ts`
On response, if the pending request used a fixture in record mode and none existed, persist the recorded response.

## Tests (`tests/faking/`)
- `mockClient.test.ts`: per-request (by factory + by `name`), per-connector, URL-pattern, and sequence matching each resolve correctly + priority order; recording + every assertion (`assertSent` by factory/name/url/closure, `assertNotSent`, `assertSentCount` global + per-factory, `assertNothingSent`, `assertSentInOrder`); global mock set/get/destroy.
- `mockResponse.test.ts`: body/status/headers; `throw()` makes `send()` reject/`.throw()` produce the error; mocked response `isMocked()` true.
- `fixture.test.ts`: record to a temp dir then replay (no live HTTP second time); path-traversal rejected; sensitive header/json/regex redaction applied to stored file.
- **Retrofit**: migrate prior phases' integration tests to use `MockClient` where a live server isn't essential.

## Done criteria
- All matching layers + assertions covered.
- Fixture record→replay round-trips through disk; redaction verified on stored bytes.
- Mocked responses flagged; recorded history accurate.

## Reference
- `../saloon/src/Http/Faking/{MockClient,FakeResponse,MockResponse,Fixture}.php`
- `../saloon/src/Http/Middleware/DetermineMockResponse.php`
- `../saloon/src/Data/RecordedResponse.php`

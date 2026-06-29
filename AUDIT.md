# saloon-js — Behavioral Parity Audit vs SaloonPHP (v3)

Audit of `saloon-js` against the PHP reference (`saloonphp/saloon` @ `v3`). The
lens is **behavioral parity**: structural divergence (functional API vs PHP
classes/traits) is intentional and is *not* treated as a finding. Only behavior
differences, bugs, and missing capabilities are reported.

**Baseline health:** `pnpm test` → 204 passing, `pnpm typecheck` clean, `pnpm
lint` clean. The port is well-tested and idiomatic; the findings below are
correctness/parity edges, not structural problems.

Severity key: **High** = breaks a common documented Saloon usage by default ·
**Medium** = wrong in a real but narrower scenario · **Low** = edge case or
API-surface gap.

---

## High

### H1. Absolute-URL endpoints don't override the base URL by default
- **Where:** `src/helpers/urlHelper.ts:11-23`, `src/http/defineRequest.ts:36`, `src/contracts/Request.ts:51`, wired at `src/http/pendingRequest.ts:124`.
- **PHP:** `URLHelper::join()` returns the endpoint unchanged whenever `isValidUrl($endpoint)` — an absolute URL **always** overrides the base. There is no `allowBaseUrlOverride` concept in v3.
- **TS:** `joinUrl(..., allowOverride = false)` only overrides when the flag is true, and `defineRequest` defaults it to `false`. So a request with a full-URL endpoint and a non-empty connector base URL produces `baseUrl + '/' + 'https://...'` — a malformed URL.
- **Fix:** Always let an absolute-URL endpoint override (drop the gate / mirror PHP's `isValidUrl` short-circuit), or default `allowBaseUrlOverride` to `true`.

### H2. Mock URL patterns miss PHP's implicit leading wildcard
- **Where:** `src/faking/mockClient.ts:141-146` (`urlMatches`), used at `:46`/`:160`.
- **PHP:** `URLHelper::matches()` = `matchesPattern(start($pattern, '*'), $value)` — every pattern is implicitly prefixed with `*`. So the canonical idiom `'github.com/*'` matches a full `https://api.github.com/...` URL.
- **TS:** `urlMatches` anchors `^…$` with no implicit leading `*`, so `'github.com/*'` compiles to `^github\.com/.*$` and never matches a real `https://…` URL — it silently falls through to the sequence / no-mock path.
- **Fix:** Normalize the pattern to an implicit leading wildcard (`'*' + pattern.replace(/^\*+/, '')`) and always run the wildcard regex path (keeping the exact-equality short-circuit).

### H3. `determineMockResponse` is registered after user/plugin request middleware (PHP registers it before)
- **Where:** `src/http/pendingRequest.ts:155` (registered after the `TAPS` loop).
- **PHP:** `PendingRequest::__construct` registers `DetermineMockResponse` **before** the taps (line 82), so it runs ahead of all connector/request/plugin request pipes. (Confirmed against source.)
- **TS:** It is appended after `mergeRequestProperties` has added the connector/request pipes, so it runs *after* them — inverted ordering. Any request pipe that inspects/mutates the pending request (auth header, URL rewrite, its own `setFakeResponse`) observes a different state/order than in PHP.
- **Fix:** Register `determineMockResponse` before the taps loop; keep `validateProperties`/`delay` appended after.

### H4. The `ManagesExceptions` extension surface is entirely missing (`hasRequestFailed` / `shouldThrowRequestException` / `getRequestException`)
- **Where:** `src/http/response.ts:85` (`failed = clientError() || serverError()`), `:113-116` (`throw()` keys off `failed()`); no such hooks on `src/contracts/Connector.ts` / `Request.ts` (grep: 0 occurrences).
- **PHP:** `failed()` consults `request/connector->hasRequestFailed()` first (lets a 200-with-error-envelope be marked failed, or a 4xx be treated as success); `throw()`/`toException()` gate on `shouldThrowRequestException()`; `createException()` can be overridden via `getRequestException()`.
- **TS:** All three are hardwired to status alone. This cascades into `throw()`, `toResult()`, `onError()`, `dtoOrFail()`, and the `alwaysThrowOnErrors` plugin.
- **Fix:** Add optional `hasRequestFailed?(res): boolean | null`, `shouldThrowRequestException?(res): boolean`, and `getRequestException?(res, cause?): Error | undefined` to connector/request configs and thread them through `response.ts` with PHP precedence (`request ?? connector`).

### H5. Form bodies serialize booleans as `true`/`false` instead of PHP's `1`/`0`
- **Where:** `src/repositories/body/formBody.ts:32` (`params.set(key, String(value))`; `FormData` value type includes `boolean`).
- **PHP:** `http_build_query(['a' => true, 'b' => false])` → `a=1&b=0`; `null` values are omitted.
- **TS:** `String(true)` → `a=true`. Any boolean form field serializes to a value PHP would never emit, likely breaking servers expecting PHP-style encoding.
- **Fix:** Map booleans to `'1'`/`'0'` before `params.set`.

### H6. Empty body suppresses the `Content-Type` header (PHP sets it unconditionally)
- **Where:** `src/http/pendingRequest.ts:181-190` (content-type only applied inside `body && !body.isEmpty()`), with `jsonBody.ts:29` / `formBody.ts:34`.
- **PHP:** The body trait's `boot…()` adds the content-type header **unconditionally** (independent of emptiness; `add()` only skips if already present). An empty `jsonBody({})` still sends `Content-Type: application/json`.
- **TS:** An empty body sends no `Content-Type`.
- **Fix:** Apply the body type's default content-type even when empty (add-if-absent), decoupled from the empty check.

### H7. OAuth2 `validateState` throws in cases PHP allows (over-strict CSRF check)
- **Where:** `src/oauth2/authorizationCodeGrant.ts:65-68` (called at `:117`). Confirmed in source.
- **PHP:** Throws only when **both** values are non-empty and differ: `! empty($state) && ! empty($expectedState) && $state !== $expectedState`.
- **TS:** `(state !== undefined || expectedState !== undefined) && state !== expectedState` — throws when only one side is set (e.g. a `state` with no `expectedState`), and treats `''` differently from PHP `empty()`.
- **Fix:** `if (state && expectedState && state !== expectedState) throw …` (mirror PHP `empty()` semantics).

---

## Medium

### M1. Fixture recording pipe uses `PipeOrder.Last`; PHP uses `First`
- `src/http/middleware/determineMockResponse.ts:36`. PHP registers `RecordFixture` with `PipeOrder::FIRST`, capturing the raw response before other response pipes mutate it. TS records the post-mutation response, so recorded fixtures can diverge. **Fix:** use `PipeOrder.First`.

### M2. `ArrayStore.get` returns a stored `null` instead of the default
- `src/repositories/arrayStore.ts:25` uses `Object.hasOwn`, so `get('k', d)` on `{k: null}` returns `null`. PHP's `$all[$key] ?? $default` coalesces a stored `null` to the default. **Fix:** `return store[key] ?? defaultValue`.

### M3. `DelayMiddleware` skips the delay on mocked sends; PHP always sleeps
- `src/http/middleware/delay.ts:15` early-returns when `hasFakeResponse()`. PHP `usleep`s unconditionally. Documented as intentional in the file header — flagged so it's a *conscious* deviation. **Fix:** either remove the short-circuit, or record it explicitly in the porting notes.

### M4. JSON body ignores PHP's encoding flags (no `setJsonFlags`; default escaping differs)
- `src/repositories/body/jsonBody.ts:29` always `JSON.stringify`. PHP defaults to `JSON_THROW_ON_ERROR` and escapes `/` (`\/`) and unicode (`\uXXXX`); `setJsonFlags()` is configurable. TS never escapes slashes/unicode and offers no flag surface. **Fix:** document the omission, or add a flags option covering slash/unicode escaping.

### M5. Exception message uses `statusText` instead of PHP's canonical reason-phrase table
- `src/errors/RequestError.ts:101` reads `fetchResponse.statusText` (often empty over HTTP/2 → `'Unknown Status'`). PHP uses `StatusCodeHelper::getMessage($status)` — a hardcoded code→phrase table independent of the server. So a 404 over HTTP/2 reads `"Unknown Status (404) …"` vs PHP's `"Not Found (404) …"`. **Fix:** port the status→phrase table. (Corroborated by two independent passes.)

### M6. `json()` on an empty body returns `undefined`; PHP returns `[]`
- `src/http/response.ts:42-55`. PHP decodes `body ?: '[]'` → empty array. Keyed access still defaults correctly in TS; only the no-key value differs. **Fix:** return `ok([])`/`ok({})` for empty bodies, or document the divergence.

### M7. OAuth `getOAuthUser` request-modifier ordering is reversed
- `src/oauth2/authorizationCodeGrant.ts:162-163`. PHP applies the per-call modifier first, then the config modifier; TS applies config first, then per-call. (Token/refresh ordering matches PHP.) **Fix:** apply the per-call modifier before the config modifier for `getOAuthUser`.

### M8. `refreshAccessToken` guards string tokens with the wrong trigger + error type
- `src/oauth2/authorizationCodeGrant.ts:142-145`. PHP only throws for an `OAuthAuthenticator` whose `isNotRefreshable()` is true (`InvalidArgumentException`); a raw string token (even `''`) is sent as-is. TS throws `OAuthConfigValidationError` for any falsy refresh token, including strings. **Fix:** guard only the authenticator-object branch; use a non-config error type.

### M9. `hasExpired` uses `<` where PHP uses `<=`
- `src/oauth2/accessTokenAuthenticator.ts:45`. A token whose `expiresAt` equals now is "live" in TS, "expired" in PHP. Affects token-store auto-refresh. **Fix:** use `<=`.

### M10. Global middleware (`Config::globalMiddleware()`) is not supported
- `src/config.ts` covers only the default sender + timeouts. PHP merges `Config::globalMiddleware()` into every pending request (`PendingRequest::__construct` line 81). No way to register process-wide middleware in the port. **Fix:** add a global middleware registry merged in `createPendingRequest`.

### M11. Pool keys are forced to 0-based integers; PHP preserves source keys
- `src/http/pool.ts:18-19,72-86`. PHP yields the source iterable's key (can be a string, e.g. `['github' => $req]`) to the response/error handlers; TS always passes pull-order integers. **Fix:** preserve `[key, value]` keys from Map/entries sources; fall back to index otherwise.

### M12. `MockConfig` is missing (global fixture path + throw-on-missing) and the default fixture dir casing differs
- No `MockConfig` equivalent; `src/faking/fixture.ts:38-39` defaults to `tests/Fixtures/saloon` (lowercase) vs PHP's `tests/Fixtures/Saloon`. There's no global "fail instead of silently record" switch. On case-sensitive filesystems, fixtures don't interoperate with a PHP suite. **Fix:** add a `throwOnMissing` option/global, align the default directory casing.

---

## Low / API-surface gaps

- **`tries <= 0` not clamped** — `src/http/send.ts:112`. PHP clamps `maxTries <= 0` to 1; TS runs zero attempts and throws `lastError` (`undefined`). Fix: `Math.max(1, …)`.
- **`retryInterval` unit** — seconds in PHP, milliseconds in TS (documented). Conscious convention change; ensure docs flag it.
- **Per-call `handleRetry` argument dropped** — PHP `send()` ANDs a third `$handleRetry` callback with the request/connector gates; TS has no per-call gate (deprecated path upstream).
- **`expires_in` numeric strings ignored** — `src/oauth2/accessTokenAuthenticator.ts:101-102` requires `typeof === 'number'`; PHP accepts numeric strings (`is_numeric`). A provider returning `"3600"` yields no expiry.
- **`authorizationUrl` doesn't filter empty scopes** — `authorizationCodeGrant.ts:86-96`; PHP `array_filter`s empties before joining, so `['', 'read']` → `scope=+read` in TS.
- **`ArrayStore.remove` missing** — PHP `ArrayStore::remove($key)` has no TS counterpart.
- **`MultipartValue` narrows value type** — `src/contracts/MultipartValue.ts`; PHP allows numeric values + validates types at runtime; TS is `string | Blob` with no runtime guard.
- **Response read helpers missing** — `array()`, `collect()`, `object(key, default)`, `isFaked()` are trivial adds. **Streaming is genuinely missing**: the port buffers the whole body (`response.ts:36` `await res.text()`), so `stream()`/`saveBodyToFile()`/`getRawStream()` large-download workflows are unsupported.
- **Latent `PipeOrder` primitive divergence** — `src/helpers/middlewarePipeline.ts:70-73` inserts eagerly (`unshift`/`push`) by registration order; PHP buckets `[first, null, last]` at execution time. Differs only when a `Last` pipe is registered before a default one (today only masked by M1).
- **Missing authenticators** — `CertificateAuthenticator` (mTLS), `DigestAuthenticator`, `NullAuthenticator` have no TS port (`AccessTokenAuthenticator` is covered by the OAuth2 module).
- **Missing typed errors** — internal guards (stray request, duplicate pipe name, no-mock-found) throw plain `Error` rather than discriminable Saloon error types.
- **Missing traits** — `Conditionable` (`when`/`unless`) and `HasDebugging` (request/response logging) have no TS surface.
- **`hasTimeout`** — TS writes timeout config in ms (vs PHP seconds), but the 10s/30s safety defaults *are* preserved at the sender level (`src/config.ts:15-16`), so the "no default" concern is covered.

---

## Out of scope (separate PHP packages / PHP-isms — correctly omitted)
Response caching (`saloonphp/cache-plugin`), rate limiting (`saloonphp/rate-limit-plugin`), paginators / `sole()` (`saloonphp/pagination-plugin`), the Guzzle sender (replaced by a pluggable `fetchSender` + `Sender` contract), `Macroable`, and PSR-7 request handling.

---

## Confirmed-faithful (spot-checked, no action)
Tap sequence and property/body merge precedence; authenticator + mock-client resolution; the non-short-circuiting request pipeline; retry **tries-vs-retries** logic (no off-by-one) and exponential-backoff exponent; `throwOnMaxTries` return-vs-throw; pool default concurrency (5); the sender's "never throw on 4xx/5xx" contract; status-class predicates and the full status→error-kind mapping (11 codes + fallbacks) with 2000-char message truncation; the five ported authenticators; `Method`/`PipeOrder` enums; `phpEmpty`/`IntegerStore` empty semantics; mock matching precedence, sequence consumption, reusable keyed mocks, and sensitive-data redaction.

---

## Suggested fix order
1. **H1, H2** — both stem from `URLHelper` parity and break the most common usages by default.
2. **H5, H6** — small, localized body-serialization fixes.
3. **H7, M9** — OAuth correctness/security (state check, expiry boundary).
4. **H3, M1, M3** — pipeline/mock ordering (group together).
5. **H4** — the largest design addition (failure/throw hooks); do as its own change.
6. Remaining Medium/Low items as capacity allows.

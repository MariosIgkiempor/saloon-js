# Testing

Mock HTTP without hitting the network. A mock client intercepts sends, returns
fake responses, and records what was sent for assertions. Works under any test
runner — assertions throw plain `Error`s.

## Fake a response

```ts
import { createMockClient, mockResponse, send } from 'saloon-js';

const mock = createMockClient([
  mockResponse({ id: '1', name: 'Ada' }),        // body, status 200 by default
  mockResponse('not found', 404),                 // string body + status
  mockResponse({ ok: false }, 500, { 'X-Trace': 'abc' }), // body, status, headers
]);

const response = await send(connector, getUser('1'), { mockClient: mock });
response.isMocked(); // true
```

Sequence responses are consumed one per send, in order. You can also build a
client incrementally — `addResponse`/`addResponses` are chainable:

```ts
const mock = createMockClient()
  .addResponse(mockResponse({ id: '1' }))            // appended to the sequence
  .addResponse(mockResponse({ who: 'user' }), getUser); // keyed (reusable)
```

## Match by name or URL

Use a `Map` to return a fake based on the request factory, request/connector
`name`, or a URL pattern. Keyed entries are reusable (not consumed).

```ts
const mock = createMockClient(new Map([
  [getUser, mockResponse({ who: 'user' })],                  // by request factory
  ['getUser', mockResponse({ who: 'by-name' })],             // by request name
  ['api', mockResponse({ who: 'connector' })],               // by connector name
  ['https://api.example.com/users/*', mockResponse({})],     // by URL wildcard
]));
```

Match priority: request name → connector name → URL pattern → sequence.

## Make a mock fail

```ts
mockResponse('boom', 500).throw();              // reject the send with the built RequestError
mockResponse({}, 200).throw(new Error('nope')); // or your own error / (pending, res) => Error
```

## Assertions

A *target* is a request factory, a request/connector `name`, a URL pattern, or a
predicate `(pending, response) => boolean` (any function taking ≥ 2 arguments).

```ts
mock.assertSent(getUser);                          // by factory
mock.assertSent('getUser');                        // by name
mock.assertSent('https://api.example.com/users/*'); // by URL pattern
mock.assertSent((pending) => pending.method === 'GET'); // by predicate

mock.assertNotSent('getOrg');
mock.assertSentCount(2, getUser);   // target optional → counts all
mock.assertNothingSent();
mock.assertSentInOrder([getUser, getOrg]);
```

Inspect recorded round-trips:

```ts
mock.getLastRequest();
mock.getLastPendingRequest();
mock.getLastResponse();
mock.getRecordedResponses();
mock.findResponseByRequest(getUser);                       // nth match (default 0)
mock.findResponseByRequestUrl('https://api.example.com/users/1');
```

## Apply globally

Skip threading `{ mockClient }` into every `send` by setting a process-global
client (precedence: per-call → request → connector → global):

```ts
import { setGlobalMockClient, destroyGlobalMockClient } from 'saloon-js';

beforeEach(() => setGlobalMockClient(createMockClient([mockResponse({ ok: true })])));
afterEach(() => destroyGlobalMockClient());
```

`getGlobalMockClient()` returns the currently-installed global client (or
`undefined`).

## Record real responses as fixtures

A `fixture` records a live response to disk on first run, then replays it
offline forever after — no network on subsequent runs.

```ts
import { fixture, createMockClient } from 'saloon-js';

// First run: hits the network and writes tests/Fixtures/saloon/users/ada.json
// Later runs: replays from disk, isMocked() === true
const mock = createMockClient([fixture('users/ada')]);
await send(connector, getUser('ada'), { mockClient: mock });
```

Redact secrets before they touch disk:

```ts
fixture('users/ada', {
  directory: 'tests/fixtures',          // default: tests/Fixtures/saloon
  sensitiveHeaders: ['authorization'],
  sensitiveJsonParameters: ['token'],
  sensitiveRegexPatterns: [/sk_live_\w+/g],
  beforeSave: (record) => record,       // final transform
});
```

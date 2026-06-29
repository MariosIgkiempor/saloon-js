// Test HTTP server for saloon-js integration tests.
//
// Zero dependencies — built on Node's `node:http`. Start one per test file in
// `beforeAll` and `await server.close()` in `afterAll`. It records and echoes
// everything it receives, plus a few routes and instrumentation that together
// cover the test suite's needs:
//
//   *               → 200, echoes { method, path, query, headers, body, rawBody }
//   /status/:code   → responds with that status + a nested JSON error body
//   /slow?ms=N      → waits N ms before echoing (timeout / abort tests)
//   /concurrent?ms=N→ holds N ms so pooled requests overlap (defaults to 50)
//   /flaky?key=K&fails=N[&status=S]
//                   → fails N times per key, then succeeds (retry tests)
//
// `server.requests` records every request since the last `reset()`;
// `server.maxInFlight` is the peak number of simultaneously-open requests
// (assert the pool's concurrency bound). Bodies are reflected raw, so multipart
// needs no parser — assert on `rawBody` / `Content-Type` directly.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface ReceivedRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  rawBody: string;
}

export interface TestServer {
  /** Base URL, e.g. `http://127.0.0.1:53421` (no trailing slash). */
  url: string;
  /** Every request received since the last `reset()`. */
  requests: ReceivedRequest[];
  /** Peak number of in-flight requests since the last `reset()`. */
  readonly maxInFlight: number;
  /** Clear recorded requests, the in-flight peak, and flaky counters. */
  reset(): void;
  /** Stop the server and release the port. */
  close(): Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const requests: ReceivedRequest[] = [];
  const flaky = new Map<string, number>();
  let inFlight = 0;
  let maxInFlight = 0;

  const server = createServer((req, res) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    let settled = false;
    const release = () => {
      if (settled) return;
      settled = true;
      inFlight -= 1;
    };
    res.on('finish', release);
    res.on('close', release);

    handle(req, res, requests, flaky).catch(() => {
      if (!res.writableEnded && !res.destroyed) res.writeHead(500).end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    get maxInFlight() {
      return maxInFlight;
    },
    reset() {
      requests.length = 0;
      flaky.clear();
      maxInFlight = 0;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  requests: ReceivedRequest[],
  flaky: Map<string, number>,
): Promise<void> {
  const rawBody = await readBody(req);
  const parsed = new URL(req.url ?? '/', 'http://localhost');
  const path = parsed.pathname;
  const query = Object.fromEntries(parsed.searchParams);
  const headers = normalizeHeaders(req);
  const method = req.method ?? 'GET';
  requests.push({ method, path, query, headers, rawBody });

  // /status/:code — respond with the given status + a nested error body.
  const statusMatch = /^\/status\/(\d{3})$/.exec(path);
  if (statusMatch) {
    const code = Number(statusMatch[1]);
    sendJson(res, code, {
      status: code,
      error: { code: `status_${code}`, message: `responded with ${code}` },
    });
    return;
  }

  // /slow?ms=N — delay before echoing (timeout / abort tests).
  if (path === '/slow') {
    await delay(Number(query.ms ?? '1000'), req);
    echo(res, { method, path, query, headers, rawBody });
    return;
  }

  // /concurrent?ms=N — hold briefly so pooled requests overlap.
  if (path === '/concurrent') {
    await delay(Number(query.ms ?? '50'), req);
    echo(res, { method, path, query, headers, rawBody });
    return;
  }

  // /flaky?key=K&fails=N[&status=S] — fail N times per key, then succeed.
  if (path === '/flaky') {
    const key = query.key ?? 'default';
    const fails = Number(query.fails ?? '1');
    const failStatus = Number(query.status ?? '503');
    const seen = flaky.get(key) ?? 0;
    flaky.set(key, seen + 1);
    if (seen < fails) {
      sendJson(res, failStatus, { status: failStatus, attempt: seen + 1 });
      return;
    }
    echo(res, { method, path, query, headers, rawBody }, { attempt: seen + 1 });
    return;
  }

  // Default: echo the request back.
  echo(res, { method, path, query, headers, rawBody });
}

function echo(
  res: ServerResponse,
  received: Omit<ReceivedRequest, never>,
  extra: Record<string, unknown> = {},
): void {
  sendJson(res, 200, {
    method: received.method,
    path: received.path,
    query: received.query,
    headers: received.headers,
    body: parseBody(received.headers['content-type'], received.rawBody),
    rawBody: received.rawBody,
    ...extra,
  });
}

/** Best-effort parse for convenience; raw text is always available via `rawBody`. */
function parseBody(contentType: string | undefined, rawBody: string): unknown {
  if (!rawBody) return null;
  const type = contentType ?? '';
  if (type.includes('application/json')) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return rawBody;
    }
  }
  if (type.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }
  // multipart/form-data and everything else: leave it raw for substring asserts.
  return rawBody;
}

function normalizeHeaders(req: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers[key] = value;
    else if (Array.isArray(value)) headers[key] = value.join(', ');
  }
  return headers;
}

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

/** Resolve after `ms`, or early if the client closes the connection (abort). */
const delay = (ms: number, req: IncomingMessage): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    req.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

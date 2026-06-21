// Port of ../saloon/src/Http/Response.php (the reading surface)
//
// Wraps a native fetch `Response`. The body is buffered once up front, because
// fetch bodies are single-use streams — every read here is from that buffer.
//
// 4xx/5xx never throw: an error status is a successful round-trip. The status
// predicates mirror SaloonPHP's `Response` helpers; obtaining the failure as a
// value is `toResult()` — `err(createRequestError(this))` — never a throw.

import type { Connector } from '@/contracts/Connector';
import type { Request } from '@/contracts/Request';
import type { Response } from '@/contracts/Response';
import { createRequestError, type RequestError } from '@/errors/RequestError';
import type { PendingRequest } from '@/http/pendingRequest';
import { createArrayStore } from '@/repositories/arrayStore';
import { err, ok as okResult, type Result } from '@/result';

export async function responseFromFetch(
  res: globalThis.Response,
  pending: PendingRequest,
  _fetchRequest: RequestInit,
  _cause?: unknown,
): Promise<Response> {
  const bodyText = await res.text();
  const headerStore = createArrayStore<string>(Object.fromEntries(res.headers.entries()));
  // Parsed lazily and cached — `json`/`object`/the dot-path read share one parse.
  let parsed: unknown;
  let didParse = false;
  const parse = (): unknown => {
    if (!didParse) {
      parsed = bodyText === '' ? undefined : JSON.parse(bodyText);
      didParse = true;
    }
    return parsed;
  };

  const status = res.status;
  const ok = () => status === 200;
  const successful = () => status >= 200 && status < 300;
  const redirect = () => status >= 300 && status < 400;
  const clientError = () => status >= 400 && status < 500;
  const serverError = () => status >= 500;
  const failed = () => clientError() || serverError();

  const response: Response = {
    status: () => status,
    headers: () => headerStore,
    header: (name) => headerStore.get(name.toLowerCase()),
    body: () => bodyText,
    json: <T = unknown>(key?: string, defaultValue?: T): T => {
      const data = parse();
      if (key === undefined) return data as T;
      return getByPath(data, key, defaultValue) as T;
    },
    object: <T = unknown>(): T => parse() as T,
    ok,
    successful,
    redirect,
    clientError,
    serverError,
    failed,
    onError(callback) {
      if (failed()) callback(response);
      return response;
    },
    toResult: (): Result<Response, RequestError> =>
      failed() ? err(createRequestError(response)) : okResult(response),
    getPendingRequest: () => pending,
    getRequest: (): Request => pending.getRequest(),
    getConnector: (): Connector => pending.getConnector(),
    getFetchResponse: () => res,
  };

  return response;
}

// A small dot-path getter mirroring PHP's `ArrayHelpers::get($data, $key, $default)`.
// `a.b.c` walks plain objects; a missing/incompatible step yields `defaultValue`.
function getByPath(data: unknown, key: string, defaultValue: unknown): unknown {
  let current = data;
  for (const segment of key.split('.')) {
    if (current === null || typeof current !== 'object') return defaultValue;
    const record = current as Record<string, unknown>;
    if (!Object.hasOwn(record, segment)) return defaultValue;
    current = record[segment];
  }
  return current;
}

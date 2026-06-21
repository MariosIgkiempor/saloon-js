// Port of ../saloon/src/Exceptions/Request/RequestException.php +
// ../saloon/src/Helpers/RequestExceptionHelper.php (collapsed into one module).
//
// In SaloonPHP a 4xx/5xx response was turned into a *thrown* exception picked from
// a deep status-class tree (NotFoundException ⊂ ClientException ⊂ RequestException
// …). saloon-js is **return-based**: `RequestError` is the value carried in the
// `Err` channel of `response.toResult()` — `send`/the sender never throw it.
//
// To keep idiomatic per-status predicates without a subclass per status, the deep
// tree collapses into a single `RequestError` class discriminated by a `kind`
// field (`RequestErrorKind`). It still `extends SaloonError` (hence `Error`) so it
// carries a stack and a *consumer* may choose to throw it — the core does not.

import type { Response } from '@/contracts/Response';
import { SaloonError } from '@/errors/SaloonError';
import type { PendingRequest } from '@/http/pendingRequest';

/** The discriminant standing in for SaloonPHP's status-exception subclasses. */
export type RequestErrorKind =
  | 'unauthorized' // 401
  | 'paymentRequired' // 402
  | 'forbidden' // 403
  | 'notFound' // 404
  | 'methodNotAllowed' // 405
  | 'requestTimeout' // 408
  | 'unprocessableEntity' // 422
  | 'tooManyRequests' // 429
  | 'internalServerError' // 500
  | 'serviceUnavailable' // 503
  | 'gatewayTimeout' // 504
  | 'clientError' // other 4xx
  | 'serverError' // other 5xx
  | 'requestError'; // anything else flagged as failed

/** Exact-status → kind, mirroring `RequestExceptionHelper`'s match arms. */
const STATUS_KIND: Record<number, RequestErrorKind> = {
  401: 'unauthorized',
  402: 'paymentRequired',
  403: 'forbidden',
  404: 'notFound',
  405: 'methodNotAllowed',
  408: 'requestTimeout',
  422: 'unprocessableEntity',
  429: 'tooManyRequests',
  500: 'internalServerError',
  503: 'serviceUnavailable',
  504: 'gatewayTimeout',
};

/** Mirrors `RequestException::$maxBodyLength` — cap the excerpt in the message. */
const MAX_BODY_LENGTH = 2000;

export class RequestError extends SaloonError {
  readonly kind: RequestErrorKind;
  readonly status: number;
  private readonly response: Response;

  constructor(
    response: Response,
    kind: RequestErrorKind,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(message ?? defaultMessage(response), options);
    this.response = response;
    this.status = response.status();
    this.kind = kind;
  }

  getResponse(): Response {
    return this.response;
  }

  getStatus(): number {
    return this.status;
  }

  getPendingRequest(): PendingRequest {
    return this.response.getPendingRequest();
  }
}

// Port of RequestExceptionHelper::create — pick the kind from the response status,
// falling back to the 5xx/4xx/other buckets exactly as PHP does.
export function createRequestError(response: Response, cause?: unknown): RequestError {
  const status = response.status();
  const kind = STATUS_KIND[status] ?? fallbackKind(response);
  return new RequestError(response, kind, undefined, cause ? { cause } : undefined);
}

function fallbackKind(response: Response): RequestErrorKind {
  if (response.serverError()) return 'serverError';
  if (response.clientError()) return 'clientError';
  return 'requestError';
}

// Port of RequestException's default message: `${statusText} (${status}) Response: ${body}`,
// with the body excerpt truncated to MAX_BODY_LENGTH.
function defaultMessage(response: Response): string {
  const status = response.status();
  const statusText = response.getFetchResponse().statusText || 'Unknown Status';
  const body = response.body();
  const excerpt = body.length > MAX_BODY_LENGTH ? body.slice(0, MAX_BODY_LENGTH) : body;
  return `${statusText} (${status}) Response: ${excerpt}`;
}

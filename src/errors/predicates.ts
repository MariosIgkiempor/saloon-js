// Predicate helpers are the primary discrimination API; `instanceof` stays
// available for those who want it. The `RequestError` predicates key off the
// `kind` discriminant (the return-based stand-in for SaloonPHP's status-class
// tree) rather than a subclass per status.

import { FatalRequestError } from '@/errors/FatalRequestError';
import type { RequestError, RequestErrorKind } from '@/errors/RequestError';
import { SaloonError } from '@/errors/SaloonError';

export function isSaloonError(error: unknown): error is SaloonError {
  return error instanceof SaloonError;
}

export function isFatalRequestError(error: unknown): error is FatalRequestError {
  return error instanceof FatalRequestError;
}

// We can't `instanceof RequestError` without importing the class value, which we
// do; but the per-status checks then compare the `kind` discriminant.
function hasKind(error: unknown, ...kinds: RequestErrorKind[]): error is RequestError {
  return isRequestError(error) && kinds.includes(error.kind);
}

export function isRequestError(error: unknown): error is RequestError {
  // `RequestError` is the only `SaloonError` carrying a numeric `status` + `kind`.
  return (
    error instanceof SaloonError &&
    'kind' in error &&
    'status' in error &&
    typeof (error as RequestError).status === 'number'
  );
}

/** Any 4xx — the named 4xx kinds plus the generic `clientError` fallback. */
export function isClientError(error: unknown): error is RequestError {
  return isRequestError(error) && error.status >= 400 && error.status < 500;
}

/** Any 5xx — the named 5xx kinds plus the generic `serverError` fallback. */
export function isServerError(error: unknown): error is RequestError {
  return isRequestError(error) && error.status >= 500;
}

export function isUnauthorizedError(error: unknown): error is RequestError {
  return hasKind(error, 'unauthorized');
}

export function isPaymentRequiredError(error: unknown): error is RequestError {
  return hasKind(error, 'paymentRequired');
}

export function isForbiddenError(error: unknown): error is RequestError {
  return hasKind(error, 'forbidden');
}

export function isNotFoundError(error: unknown): error is RequestError {
  return hasKind(error, 'notFound');
}

export function isMethodNotAllowedError(error: unknown): error is RequestError {
  return hasKind(error, 'methodNotAllowed');
}

export function isRequestTimeoutError(error: unknown): error is RequestError {
  return hasKind(error, 'requestTimeout');
}

export function isUnprocessableEntityError(error: unknown): error is RequestError {
  return hasKind(error, 'unprocessableEntity');
}

export function isTooManyRequestsError(error: unknown): error is RequestError {
  return hasKind(error, 'tooManyRequests');
}

export function isInternalServerError(error: unknown): error is RequestError {
  return hasKind(error, 'internalServerError');
}

export function isServiceUnavailableError(error: unknown): error is RequestError {
  return hasKind(error, 'serviceUnavailable');
}

export function isGatewayTimeoutError(error: unknown): error is RequestError {
  return hasKind(error, 'gatewayTimeout');
}

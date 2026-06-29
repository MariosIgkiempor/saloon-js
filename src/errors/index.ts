export { FatalRequestError } from '@/errors/FatalRequestError';
export { InvalidStateError } from '@/errors/oauth/InvalidStateError';
export { OAuthConfigValidationError } from '@/errors/oauth/OAuthConfigValidationError';
export {
  isInvalidStateError,
  isOAuthConfigValidationError,
} from '@/errors/oauth/predicates';
export {
  isClientError,
  isFatalRequestError,
  isForbiddenError,
  isGatewayTimeoutError,
  isInternalServerError,
  isMethodNotAllowedError,
  isNotFoundError,
  isPaymentRequiredError,
  isRequestError,
  isRequestTimeoutError,
  isSaloonError,
  isServerError,
  isServiceUnavailableError,
  isTooManyRequestsError,
  isUnauthorizedError,
  isUnprocessableEntityError,
  isValidationError,
} from '@/errors/predicates';
export {
  createRequestError,
  RequestError,
  type RequestErrorKind,
} from '@/errors/RequestError';
export { SaloonError } from '@/errors/SaloonError';
export { ValidationError, type ValidationErrorOptions } from '@/errors/ValidationError';

export { FatalRequestError } from '@/errors/FatalRequestError';
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
} from '@/errors/predicates';
export {
  createRequestError,
  RequestError,
  type RequestErrorKind,
} from '@/errors/RequestError';
export { SaloonError } from '@/errors/SaloonError';

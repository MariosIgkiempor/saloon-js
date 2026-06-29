// Public barrel. Slice 1 exports the GET round-trip surface; later slices add to
// this (a curated, tree-shakeable barrel is finalized in Slice 8).

export { basicAuth, headerAuth, multiAuth, queryAuth, tokenAuth } from '@/auth';
export type {
  Authenticator,
  AuthValue,
  BodyRepository,
  BootHook,
  ConfigValue,
  Connector,
  ConnectorConfig,
  FakeResponse,
  FetchRequestHook,
  Fixture,
  HeadersConfig,
  HeaderValue,
  MergeableBody,
  MiddlewareRegistrar,
  MockClient,
  MockValue,
  MultipartValue,
  Plugin,
  QueryConfig,
  QueryValue,
  RecordedResponse,
  Request,
  RequestBody,
  RequestConfig,
  RequestOptionsConfig,
  Response,
  RetryConfig,
  RetryHandler,
  Sender,
  SentMatcher,
} from '@/contracts';
export { Method, PipeOrder } from '@/enums';
export {
  createRequestError,
  FatalRequestError,
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
  RequestError,
  type RequestErrorKind,
  SaloonError,
} from '@/errors';
export {
  createMockClient,
  destroyGlobalMockClient,
  type FixtureOptions,
  fixture,
  getGlobalMockClient,
  type MockResponse,
  mockResponse,
  type RecordedFixture,
  setGlobalMockClient,
} from '@/faking';
export {
  createMiddlewarePipeline,
  type FatalMiddleware,
  type MiddlewarePipeline,
  type RequestMiddleware,
  type ResponseMiddleware,
} from '@/helpers/middlewarePipeline';
export { defineConnector } from '@/http/defineConnector';
export { defineRequest } from '@/http/defineRequest';
export type { PendingRequest, ResponseFactory, SendOptions } from '@/http/pendingRequest';
export {
  type Pool,
  type PoolErrorHandler,
  type PoolKey,
  type PoolOptions,
  type PoolRequests,
  type PoolResponseHandler,
  pool,
} from '@/http/pool';
export { send } from '@/http/send';
export { createFetchSender, fetchSender } from '@/http/senders/fetchSender';
export {
  withAuth,
  withBody,
  withConfig,
  withHeaders,
  withMiddleware,
  withQuery,
  withRetry,
} from '@/http/transformers';
export {
  acceptsJson,
  alwaysThrowOnErrors,
  hasTimeout,
  type TimeoutOptions,
} from '@/plugins';
export { type ArrayStore, createArrayStore } from '@/repositories/arrayStore';
export {
  type FormBody,
  formBody,
  type JsonBody,
  jsonBody,
  type MultipartBody,
  multipartBody,
  type StreamBody,
  type StringBody,
  streamBody,
  stringBody,
} from '@/repositories/body';
export { createIntegerStore, type IntegerStore } from '@/repositories/integerStore';
export { err, isErr, isOk, ok, type Result } from '@/result';

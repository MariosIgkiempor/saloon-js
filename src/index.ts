// Public barrel. Slice 1 exports the GET round-trip surface; later slices add to
// this (a curated, tree-shakeable barrel is finalized in Slice 8).

export type {
  BodyRepository,
  ConfigValue,
  Connector,
  ConnectorConfig,
  HeadersConfig,
  HeaderValue,
  MergeableBody,
  MultipartValue,
  QueryConfig,
  QueryValue,
  Request,
  RequestBody,
  RequestConfig,
  RequestOptionsConfig,
  Response,
  Sender,
} from '@/contracts';
export { Method } from '@/enums';
export {
  BodyException,
  FatalRequestError,
  isBodyException,
  isFatalRequestError,
  isSaloonError,
  SaloonError,
} from '@/errors';
export { defineConnector } from '@/http/defineConnector';
export { defineRequest } from '@/http/defineRequest';
export type { PendingRequest, ResponseFactory } from '@/http/pendingRequest';
export { send } from '@/http/send';
export { createFetchSender, fetchSender } from '@/http/senders/fetchSender';
export {
  withBody,
  withConfig,
  withHeaders,
  withQuery,
} from '@/http/transformers';
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

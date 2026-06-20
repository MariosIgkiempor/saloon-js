// Public barrel. Slice 1 exports the GET round-trip surface; later slices add to
// this (a curated, tree-shakeable barrel is finalized in Slice 8).

export type {
  Connector,
  ConnectorConfig,
  HeadersConfig,
  HeaderValue,
  QueryConfig,
  QueryValue,
  Request,
  RequestConfig,
  Response,
  Sender,
} from '@/contracts';
export { Method } from '@/enums';
export { FatalRequestError, isFatalRequestError, isSaloonError, SaloonError } from '@/errors';
export { defineConnector } from '@/http/defineConnector';
export { defineRequest } from '@/http/defineRequest';
export type { PendingRequest, ResponseFactory } from '@/http/pendingRequest';
export { send } from '@/http/send';
export { createFetchSender, fetchSender } from '@/http/senders/fetchSender';
export { type ArrayStore, createArrayStore } from '@/repositories/arrayStore';

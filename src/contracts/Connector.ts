// The normalized connector value (out of `defineConnector`) and its input config.
// Only the members Slice 1 reads are declared; later slices extend these with
// `auth`/`body`/`plugins`/`middleware`/`boot`/`retry`/`oauth`/`tokens`/….

import type { Sender } from '@/contracts/Sender';
import type { ArrayStore } from '@/repositories/arrayStore';

export type HeaderValue = string | number | boolean;
export type QueryValue = string | number | boolean;
export type HeadersConfig = Record<string, HeaderValue>;
export type QueryConfig = Record<string, QueryValue>;

/** The normalized, frozen connector produced by `defineConnector`. */
export interface Connector {
  baseUrl: string | ((connector: Connector) => string);
  headers: ArrayStore<HeaderValue>;
  query: ArrayStore<QueryValue>;
  sender: Sender;
  name?: string;
}

/** The input accepted by `defineConnector`. */
export interface ConnectorConfig {
  baseUrl: string | ((connector: Connector) => string);
  headers?: HeadersConfig;
  query?: QueryConfig;
  sender?: Sender;
  name?: string;
}

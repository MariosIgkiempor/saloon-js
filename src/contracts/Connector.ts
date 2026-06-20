// The normalized connector value (out of `defineConnector`) and its input config.
// Only the members Slice 1 reads are declared; later slices extend these with
// `auth`/`body`/`plugins`/`middleware`/`boot`/`retry`/`oauth`/`tokens`/….

import type { BodyRepository } from '@/contracts/BodyRepository';
import type { Sender } from '@/contracts/Sender';
import type { ArrayStore } from '@/repositories/arrayStore';

export type HeaderValue = string | number | boolean;
export type QueryValue = string | number | boolean;
/** The misc per-request options bag (timeouts etc. land here in Slice 4). */
export type ConfigValue = unknown;
export type HeadersConfig = Record<string, HeaderValue>;
export type QueryConfig = Record<string, QueryValue>;
export type RequestOptionsConfig = Record<string, ConfigValue>;

/** The normalized, frozen connector produced by `defineConnector`. */
export interface Connector {
  baseUrl: string | ((connector: Connector) => string);
  headers: ArrayStore<HeaderValue>;
  query: ArrayStore<QueryValue>;
  config: ArrayStore<ConfigValue>;
  // Thunk-or-value, like `baseUrl`/`endpoint`: resolved per-send in MergeBody.
  body?: BodyRepository | (() => BodyRepository);
  sender: Sender;
  name?: string;
}

/** The input accepted by `defineConnector`. */
export interface ConnectorConfig {
  baseUrl: string | ((connector: Connector) => string);
  headers?: HeadersConfig;
  query?: QueryConfig;
  config?: RequestOptionsConfig;
  body?: BodyRepository | (() => BodyRepository);
  sender?: Sender;
  name?: string;
}

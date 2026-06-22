// The normalized connector value (out of `defineConnector`) and its input config.
// Only the members the lifecycle reads so far are declared; later slices extend
// these with `retry`/`oauth`/`tokens`/`mockClient`/….

import type { Authenticator } from '@/contracts/Authenticator';
import type { BodyRepository } from '@/contracts/BodyRepository';
import type { MockClient } from '@/contracts/MockClient';
import type { Plugin } from '@/contracts/Plugin';
import type { Sender } from '@/contracts/Sender';
import type { MiddlewarePipeline } from '@/helpers/middlewarePipeline';
import type { PendingRequest } from '@/http/pendingRequest';
import type { ArrayStore } from '@/repositories/arrayStore';

export type HeaderValue = string | number | boolean;
export type QueryValue = string | number | boolean;
/** The misc per-request options bag (timeouts land here via `hasTimeout`/config). */
export type ConfigValue = unknown;
export type HeadersConfig = Record<string, HeaderValue>;
export type QueryConfig = Record<string, QueryValue>;
export type RequestOptionsConfig = Record<string, ConfigValue>;

/** An authenticator value, or a thunk resolved per-send (like `baseUrl`/`body`). */
export type AuthValue = Authenticator | (() => Authenticator);
/** Registers middleware against a send's pipeline (the `middleware` config field). */
export type MiddlewareRegistrar = (pipeline: MiddlewarePipeline) => void;
/** The functional replacement for PHP's `boot(PendingRequest)` override. */
export type BootHook = (pending: PendingRequest) => void;
/** A last hook over the native fetch init; return a replacement or mutate in place. */
// biome-ignore lint/suspicious/noConfusingVoidType: void lets a hook mutate `init` in place and return nothing.
export type FetchRequestHook = (init: RequestInit, pending: PendingRequest) => RequestInit | void;

/** The normalized, frozen connector produced by `defineConnector`. */
export interface Connector {
  baseUrl: string | ((connector: Connector) => string);
  headers: ArrayStore<HeaderValue>;
  query: ArrayStore<QueryValue>;
  config: ArrayStore<ConfigValue>;
  // Thunk-or-value, like `baseUrl`/`endpoint`: resolved per-send in MergeBody.
  body?: BodyRepository | (() => BodyRepository);
  auth?: AuthValue;
  // Normalized to `[]` by `defineConnector`, so the boot tap can iterate freely.
  plugins: Plugin[];
  middleware?: MiddlewareRegistrar;
  boot?: BootHook;
  handleFetchRequest?: FetchRequestHook;
  // Default mock client for this connector (overridden by per-call/request/global).
  mockClient?: MockClient;
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
  auth?: AuthValue;
  plugins?: Plugin[];
  middleware?: MiddlewareRegistrar;
  boot?: BootHook;
  handleFetchRequest?: FetchRequestHook;
  mockClient?: MockClient;
  sender?: Sender;
  name?: string;
}

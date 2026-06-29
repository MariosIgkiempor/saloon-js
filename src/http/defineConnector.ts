// Port of ../saloon/src/Http/Connector.php (the resolve/default surface)

import { getDefaultSender } from '@/config';
import type {
  ConfigValue,
  Connector,
  ConnectorConfig,
  HeaderValue,
  QueryValue,
} from '@/contracts/Connector';
import { createArrayStore } from '@/repositories/arrayStore';

/** Normalize connector config into a frozen, reusable value. */
export function defineConnector(config: ConnectorConfig): Connector {
  const connector: Connector = {
    baseUrl: config.baseUrl,
    headers: createArrayStore<HeaderValue>(config.headers),
    query: createArrayStore<QueryValue>(config.query),
    config: createArrayStore<ConfigValue>(config.config),
    body: config.body,
    auth: config.auth,
    plugins: config.plugins ?? [],
    middleware: config.middleware,
    boot: config.boot,
    handleFetchRequest: config.handleFetchRequest,
    mockClient: config.mockClient,
    tries: config.tries,
    retryInterval: config.retryInterval,
    useExponentialBackoff: config.useExponentialBackoff,
    throwOnMaxTries: config.throwOnMaxTries,
    handleRetry: config.handleRetry,
    delay: config.delay,
    oauth: config.oauth,
    tokens: config.tokens,
    validator: config.validator,
    sender: config.sender ?? getDefaultSender(),
    name: config.name,
  };

  return Object.freeze(connector);
}

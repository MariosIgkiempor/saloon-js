// Port of ../saloon/src/Http/Connector.php (the resolve/default surface)

import { getDefaultSender } from '@/config';
import type { Connector, ConnectorConfig, HeaderValue, QueryValue } from '@/contracts/Connector';
import { createArrayStore } from '@/repositories/arrayStore';

/** Normalize connector config into a frozen, reusable value. */
export function defineConnector(config: ConnectorConfig): Connector {
  const connector: Connector = {
    baseUrl: config.baseUrl,
    headers: createArrayStore<HeaderValue>(config.headers),
    query: createArrayStore<QueryValue>(config.query),
    sender: config.sender ?? getDefaultSender(),
    name: config.name,
  };

  return Object.freeze(connector);
}

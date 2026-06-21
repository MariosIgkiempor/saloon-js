// Port of ../saloon/src/Http/PendingRequest/MergeRequestProperties.php
//
// Merge headers/query/config from connector then request into the pending
// request's (empty) stores. Connector provides defaults; the request is merged
// second, so request values win on conflicts. This also registers the connector
// then request middleware against this send's pipeline (request second, so its
// pipes run after the connector's).

import type { PendingRequest } from '@/http/pendingRequest';

export function mergeRequestProperties(pending: PendingRequest): void {
  const connector = pending.getConnector();
  const request = pending.getRequest();

  pending.headers.merge(connector.headers.all(), request.headers.all());
  pending.query.merge(connector.query.all(), request.query.all());
  pending.config.merge(connector.config.all(), request.config.all());

  connector.middleware?.(pending.middleware);
  request.middleware?.(pending.middleware);
}

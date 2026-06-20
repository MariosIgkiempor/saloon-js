// Port of ../saloon/src/Http/PendingRequest/MergeRequestProperties.php
//
// The first tap: merge headers/query/config from connector then request into the
// pending request's (empty) stores. Connector provides defaults; the request is
// merged second, so request values win on conflicts. (Middleware merge lands in
// Slice 4.)

import type { PendingRequest } from '@/http/pendingRequest';

export function mergeRequestProperties(pending: PendingRequest): void {
  const connector = pending.getConnector();
  const request = pending.getRequest();

  pending.headers.merge(connector.headers.all(), request.headers.all());
  pending.query.merge(connector.query.all(), request.query.all());
  pending.config.merge(connector.config.all(), request.config.all());
}

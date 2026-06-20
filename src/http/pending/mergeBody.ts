// Port of ../saloon/src/Http/PendingRequest/MergeBody.php
//
// The second tap: resolve connector/request bodies (supporting the thunk form),
// clone them so the definitions are never mutated, and combine:
//   - neither set        → no body
//   - only one set       → that body wins
//   - both, kinds differ → throw (incompatible types)
//   - both mergeable     → request merged into a clone of the connector body
//   - both, non-mergeable→ request body wins wholesale

import type { BodyRepository } from '@/contracts/BodyRepository';
import type { Connector } from '@/contracts/Connector';
import type { MergeableBody } from '@/contracts/MergeableBody';
import { BodyException } from '@/errors/BodyException';
import type { PendingRequest } from '@/http/pendingRequest';

type BodyConfig = Connector['body'];

function resolveBody(body: BodyConfig): BodyRepository | undefined {
  return typeof body === 'function' ? body() : body;
}

function isMergeableBody(body: BodyRepository): body is BodyRepository & MergeableBody {
  return typeof (body as Partial<MergeableBody>).merge === 'function';
}

export function mergeBody(pending: PendingRequest): void {
  const connectorBody = resolveBody(pending.getConnector().body);
  const requestBody = resolveBody(pending.getRequest().body);

  if (!connectorBody && !requestBody) return;
  if (!connectorBody) {
    pending.setBody(requestBody?.clone());
    return;
  }
  if (!requestBody) {
    pending.setBody(connectorBody.clone());
    return;
  }

  if (connectorBody.kind !== requestBody.kind) {
    throw new BodyException('Connector and request body types must be the same.');
  }

  if (isMergeableBody(connectorBody) && isMergeableBody(requestBody)) {
    const merged = connectorBody.clone();
    // The clone of a mergeable body is mergeable; re-narrow to avoid a cast.
    if (isMergeableBody(merged)) merged.merge(requestBody.all());
    pending.setBody(merged);
    return;
  }

  // Non-mergeable (string/stream): the request body wins wholesale.
  pending.setBody(requestBody.clone());
}

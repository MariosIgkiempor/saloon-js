// Port of ../saloon/src/Http/PendingRequest/MergeBody.php
//
// The second tap: resolve connector/request bodies (supporting the thunk form),
// clone them so the definitions are never mutated, and combine:
//   - neither set                     → no body
//   - only one set                    → that body wins
//   - both, same mergeable kind       → request merged into a clone of the connector body
//   - both, otherwise                 → request body wins wholesale
//
// Unlike SaloonPHP (which throws when the kinds differ), we never throw here:
// per the error policy the request body simply wins on a mismatch, consistent
// with the request-wins precedence everywhere else.

import type { BodyRepository } from '@/contracts/BodyRepository';
import type { Connector } from '@/contracts/Connector';
import type { MergeableBody } from '@/contracts/MergeableBody';
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

  // Merge only when both are the same mergeable kind.
  if (
    connectorBody.kind === requestBody.kind &&
    isMergeableBody(connectorBody) &&
    isMergeableBody(requestBody)
  ) {
    const merged = connectorBody.clone();
    // The clone of a mergeable body is mergeable; re-narrow to avoid a cast.
    if (isMergeableBody(merged)) merged.merge(requestBody.all());
    pending.setBody(merged);
    return;
  }

  // Different kinds, or non-mergeable (string/stream): the request body wins.
  pending.setBody(requestBody.clone());
}

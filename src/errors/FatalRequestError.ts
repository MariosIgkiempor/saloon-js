// Port of ../saloon/src/Exceptions/FatalRequestException.php
//
// Thrown by the sender when the transport itself fails (DNS, connection refused,
// abort) — i.e. there is no HTTP response at all. The originating error is set as
// `cause`; the half-built request is kept for inspection.

import { SaloonError } from '@/errors/SaloonError';
import type { PendingRequest } from '@/http/pendingRequest';

export class FatalRequestError extends SaloonError {
  readonly pendingRequest: PendingRequest;

  constructor(cause: unknown, pendingRequest: PendingRequest) {
    super(messageFrom(cause), { cause });
    this.pendingRequest = pendingRequest;
  }

  getPendingRequest(): PendingRequest {
    return this.pendingRequest;
  }
}

function messageFrom(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

import type { Response } from '@/contracts/Response';
import type { PendingRequest } from '@/http/pendingRequest';

/** A sender turns a built `PendingRequest` into a `Response`. */
export interface Sender {
  send(pending: PendingRequest): Promise<Response>;
}

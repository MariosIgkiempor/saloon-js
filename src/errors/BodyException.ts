// Port of ../saloon/src/Http/PendingRequest/MergeBody.php (the thrown exception)
//
// Thrown by the MergeBody tap when a connector body and request body are of
// different kinds and therefore can't be combined. PHP throws a
// PendingRequestException here; the port uses a body-specific class discriminated
// via `isBodyException` — structure diverges, behavior/message preserved.

import { SaloonError } from '@/errors/SaloonError';

export class BodyException extends SaloonError {}

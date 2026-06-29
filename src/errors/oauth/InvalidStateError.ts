// Port of SaloonPHP's InvalidStateException.
//
// Thrown by `exchangeCode` when the OAuth2 `state` returned on the callback does
// not match the `expectedState` the caller stashed — the CSRF guard. Extends
// `SaloonError` (the Error carve-out); discriminate with `isInvalidStateError`.

import { SaloonError } from '@/errors/SaloonError';

export class InvalidStateError extends SaloonError {}

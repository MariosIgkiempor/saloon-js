// Predicate helpers are the primary discrimination API; `instanceof` stays
// available for those who want it. The rest of the hierarchy lands in Slice 3.

import { FatalRequestError } from '@/errors/FatalRequestError';
import { SaloonError } from '@/errors/SaloonError';

export function isSaloonError(error: unknown): error is SaloonError {
  return error instanceof SaloonError;
}

export function isFatalRequestError(error: unknown): error is FatalRequestError {
  return error instanceof FatalRequestError;
}

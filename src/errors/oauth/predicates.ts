// Predicate helpers for the OAuth2 errors — the primary discrimination API
// (the error-type carve-out: throwables stay classes, but are matched via predicates).

import { InvalidStateError } from '@/errors/oauth/InvalidStateError';
import { OAuthConfigValidationError } from '@/errors/oauth/OAuthConfigValidationError';

export function isOAuthConfigValidationError(error: unknown): error is OAuthConfigValidationError {
  return error instanceof OAuthConfigValidationError;
}

export function isInvalidStateError(error: unknown): error is InvalidStateError {
  return error instanceof InvalidStateError;
}

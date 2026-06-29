// Port of SaloonPHP's OAuthConfigValidationException.
//
// Thrown by `validateOAuthConfig` (and the grant functions, via
// `requireOAuthConfig`) when an OAuth2 config is missing required fields. Extends
// `SaloonError` (the Error carve-out); discriminate with `isOAuthConfigValidationError`.

import { SaloonError } from '@/errors/SaloonError';

export class OAuthConfigValidationError extends SaloonError {}

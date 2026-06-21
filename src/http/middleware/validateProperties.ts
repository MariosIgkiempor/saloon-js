// A light property-validation request middleware (no direct PHP port — PHP relied
// on its `HasBody`/typed-property machinery, which the functional API doesn't have).
//
// saloon-js models bodies as optional and resolves misconfiguration to a winner
// rather than throwing (see `.claude/plans/api-style.md`), so there is nothing
// *required* to enforce yet. This is the registered lifecycle slot where stricter,
// opt-in validation can attach later; per the error policy it never throws and
// leaves the pending request unchanged.

import type { PendingRequest } from '@/http/pendingRequest';

export function validateProperties(_pending: PendingRequest): void {
  // Intentionally minimal — see the module header.
}

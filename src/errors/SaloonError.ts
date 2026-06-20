// Port of ../saloon/src/Exceptions/SaloonException.php
//
// The one carve-out from the no-classes rule: a throwable must extend `Error`.
// Discrimination is done with predicate helpers (see `predicates.ts`), not
// authoring/subclassing.

export class SaloonError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

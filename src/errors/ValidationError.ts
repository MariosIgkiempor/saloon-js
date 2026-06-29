// Thrown when a response body fails its request/connector `validator`. Extends
// `SaloonError` (the Error carve-out); discriminate with `isValidationError`.
//
// `send` throws this on a *successful* response whose body does not validate — the
// second (and only other) deliberate exception to "send throws only the network
// error", alongside `FatalRequestError`. The non-throwing path is
// `response.validate()` / `validateAsync()`, which return a `Result`.

import type { StandardSchemaIssue } from '@/contracts/StandardSchema';
import { SaloonError } from '@/errors/SaloonError';

export interface ValidationErrorOptions {
  /** The value that failed validation (the parsed body). */
  value?: unknown;
  /** The underlying error, when wrapping a thrown function-validator failure. */
  cause?: unknown;
}

export class ValidationError extends SaloonError {
  /** The issues describing why validation failed (Standard Schema shape). */
  readonly issues: readonly StandardSchemaIssue[];
  /** The value that failed validation, when available. */
  readonly value?: unknown;

  constructor(issues: readonly StandardSchemaIssue[], options: ValidationErrorOptions = {}) {
    super(messageFrom(issues), options.cause !== undefined ? { cause: options.cause } : undefined);
    this.issues = issues;
    this.value = options.value;
  }

  /** Wrap an error thrown by a function validator into a single-issue `ValidationError`. */
  static fromThrown(error: unknown, value?: unknown): ValidationError {
    if (error instanceof ValidationError) return error;
    const message = error instanceof Error ? error.message : String(error);
    return new ValidationError([{ message }], { value, cause: error });
  }
}

function messageFrom(issues: readonly StandardSchemaIssue[]): string {
  if (issues.length === 0) return 'Response validation failed';
  return `Response validation failed: ${issues.map((issue) => issue.message).join('; ')}`;
}

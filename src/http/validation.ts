// Runs a `Validator` (function or Standard Schema) against parsed data, returning a
// return-based `Result` (never throws). Standard Schemas may validate
// synchronously or return a Promise; function validators signal failure by
// throwing. The Promise case is propagated so callers can `await` it
// (`response.validateAsync`) or detect it (`response.validate`).

import type { StandardSchemaResult, StandardSchemaV1 } from '@/contracts/StandardSchema';
import type { Validator } from '@/contracts/Validator';
import { ValidationError } from '@/errors/ValidationError';
import { err, ok, type Result } from '@/result';

/** A Standard Schema is an object carrying the `~standard` property. */
function isStandardSchema(validator: unknown): validator is StandardSchemaV1 {
  return typeof validator === 'object' && validator !== null && '~standard' in validator;
}

function mapStandardResult<T>(
  result: StandardSchemaResult<unknown>,
  data: unknown,
): Result<T, ValidationError> {
  if (result.issues) return err(new ValidationError(result.issues, { value: data }));
  return ok(result.value as T);
}

/**
 * Validate `data` with `validator`. Returns a `Result` synchronously when the
 * validator is synchronous, or a `Promise<Result>` when it is asynchronous.
 */
export function runValidator<T>(
  validator: Validator<T>,
  data: unknown,
): Result<T, ValidationError> | Promise<Result<T, ValidationError>> {
  if (isStandardSchema(validator)) {
    const outcome = validator['~standard'].validate(data);
    return outcome instanceof Promise
      ? outcome.then((result) => mapStandardResult<T>(result, data))
      : mapStandardResult<T>(outcome, data);
  }

  // Function validator: it returns the validated value, or throws on invalid.
  try {
    const value = validator(data);
    return value instanceof Promise
      ? value.then(
          (resolved) => ok(resolved as T),
          (error: unknown) => err(ValidationError.fromThrown(error, data)),
        )
      : ok(value as T);
  } catch (error) {
    return err(ValidationError.fromThrown(error, data));
  }
}

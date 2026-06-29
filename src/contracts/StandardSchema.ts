// Vendored Standard Schema spec (https://standardschema.dev) — type-only, zero
// runtime dependency. The spec is co-authored by the Zod/Valibot/ArkType
// maintainers and explicitly meant to be copied in: any schema exposing a
// conforming `~standard` property (Zod ≥3.24, Valibot ≥1.0, ArkType ≥2.0, …) is
// accepted by `Validator` without saloon-js depending on the library.
//
// Not a SaloonPHP port — SaloonPHP has no equivalent; this is a saloon-js feature.
//
// The canonical spec groups these under a `StandardSchemaV1` namespace; we flatten
// the helper types (Biome disallows `namespace`) while keeping the `~standard`
// shape structurally identical, so conforming schemas stay assignable.

/** A schema implementing the Standard Schema interface. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly '~standard': StandardSchemaProps<Input, Output>;
}

/** The Standard Schema properties interface. */
export interface StandardSchemaProps<Input = unknown, Output = Input> {
  /** The version number of the standard. */
  readonly version: 1;
  /** The vendor name of the schema library (e.g. `'zod'`, `'valibot'`). */
  readonly vendor: string;
  /** Validates an unknown input value (synchronously or asynchronously). */
  readonly validate: (
    value: unknown,
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
  /** Inferred input/output types associated with the schema (type-only). */
  readonly types?: StandardSchemaTypes<Input, Output> | undefined;
}

/** The result of a validate call. */
export type StandardSchemaResult<Output> =
  | StandardSchemaSuccessResult<Output>
  | StandardSchemaFailureResult;

/** The result when validation succeeds. */
export interface StandardSchemaSuccessResult<Output> {
  /** The typed, validated output value. */
  readonly value: Output;
  /** Absent on success. */
  readonly issues?: undefined;
}

/** The result when validation fails. */
export interface StandardSchemaFailureResult {
  /** The issues describing why validation failed. */
  readonly issues: ReadonlyArray<StandardSchemaIssue>;
}

/** A single validation issue. */
export interface StandardSchemaIssue {
  /** The human-readable error message. */
  readonly message: string;
  /** The path to the offending value, if any. */
  readonly path?: ReadonlyArray<PropertyKey | StandardSchemaPathSegment> | undefined;
}

/** A path segment within an issue. */
export interface StandardSchemaPathSegment {
  /** The key representing the path segment. */
  readonly key: PropertyKey;
}

/** The inferred input/output types of a schema (type-only). */
export interface StandardSchemaTypes<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}

/** Infer the input type of a Standard Schema. */
export type InferStandardInput<Schema extends StandardSchemaV1> = NonNullable<
  Schema['~standard']['types']
>['input'];

/** Infer the output type of a Standard Schema. */
export type InferStandardOutput<Schema extends StandardSchemaV1> = NonNullable<
  Schema['~standard']['types']
>['output'];

# Data validation — `validator` + type inference

> **Status:** shipped. The vertical-slice roadmap (slices 1–8) is complete and its
> plan files were removed; this is the first feature beyond the SaloonPHP port.
> Cross-cutting API style still lives in [api-style.md](api-style.md).

## What it does

A request (or connector) carries a `validator`. saloon-js then:

1. **Infers** the response type from it — `defineRequest({ validator })` is
   `Request<TDto>` with no explicit type argument.
2. **Validates** the body automatically: `send` runs the validator against a
   **successful** response and throws a `ValidationError` on a mismatch.

A `validator` is **either** a plain function `(data: unknown) => T` (throws on
invalid; may be async) **or** any [Standard Schema](https://standardschema.dev)
(Zod ≥3.24 / Valibot ≥1.0 / ArkType ≥2.0 / …). This **replaced** the old `dto`
cast hook. User-facing docs: [`docs/validation.md`](../../docs/validation.md).

## Why Standard Schema (the "no Zod dependency" answer)

Standard Schema is a vendor-neutral spec (a `~standard` property) co-authored by
the Zod/Valibot/ArkType maintainers, designed to be **vendored as types**. We
copied the ~40-line interface into `src/contracts/StandardSchema.ts` (flattened
out of the spec's `namespace`, which Biome disallows) — zero runtime dependency,
yet any conforming schema is accepted and its output type inferred.

## Key decisions

- **`validator` replaced `dto`.** The `dto`/`DtoCaster` config hooks are gone.
  The accessor names `dto()`/`dtoOrFail()` are kept but are now validation-backed.
- **Eager validation in `send`** — the second deliberate exception to "send throws
  only the network error" (alongside `FatalRequestError`). Only successful
  responses are validated; 4xx/5xx are returned unvalidated. `ValidationError` is
  neither `Fatal`- nor `RequestError`, so the retry loop never retries it.
- **Return-based reads** — `response.validate()` / `validateAsync()` return
  `Result<TDto, ValidationError>` and never throw. The outcome is memoized once.
- **Inference via the original `<TDto>` signature** — `defineRequest<TDto>(config:
  RequestConfig<TDto>)` with `validator?: Validator<TDto>` infers `TDto` from the
  validator *and* contextually types an inline `(data) => …`'s parameter as
  `unknown`. (A `V extends Validator<…>`-generic variant was tried and rejected:
  it broke inference for inline unannotated functions.)

## Map of the code

| Concern | File |
| --- | --- |
| Vendored spec (types) | `src/contracts/StandardSchema.ts` |
| `Validator`, `ValidatorFn`, `InferValidated` | `src/contracts/Validator.ts` |
| Run a validator → `Result` (sync/async) | `src/http/validation.ts` (`runValidator`) |
| `ValidationError` + `isValidationError` | `src/errors/ValidationError.ts`, `src/errors/predicates.ts` |
| `validator` config field | `src/contracts/Request.ts`, `src/contracts/Connector.ts`, `defineRequest.ts`, `defineConnector.ts` |
| `validate`/`validateAsync`/`dto` + memo | `src/contracts/Response.ts`, `src/http/response.ts` |
| Eager validation on send | `src/http/send.ts` (`attempt`) |
| Tests | `tests/http/validation.test.ts` |

## Open follow-ups

- Validating non-JSON bodies; request-side (input) validation.
- A per-request opt-out of eager throwing (e.g. `validate: 'lazy'`), if throw-on-send
  proves too aggressive for some callers.
- Optionally surface a richer issue `path` in `ValidationError.message`.

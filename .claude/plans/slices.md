# Implementation roadmap — vertical slices

> Each slice ends with something you can `send()` and a green test against a real
> local server (or, from Slice 6, the mock client). Shared machinery is introduced
> thin in the first slice that needs it and thickened where it's exercised; nothing
> is created before the slice that uses it.
>
> Every slice opens with an **Example (consumer API)** snippet — the design-first
> target showing what that slice's feature looks like to use, before the file
> breakdown. The snippets compose into `examples/github-api`.

## The slices
1. **[GET round-trip](slice-1-get-roundtrip.md)** — walking skeleton: minimal
   stores/contracts/define*/pendingRequest/response/fetchSender; one real GET works.
2. **[POST, body & precedence](slice-2-post-body-precedence.md)** — body repos
   (json/form/multipart/string/stream), merge taps, `withX` transformers.
3. **[Errors & response reading](slice-3-errors-response-reading.md)** — full error
   hierarchy + predicates, `createRequestError`, complete `Response` reading API.
4. **[Pipeline, plugins & auth](slice-4-pipeline-plugins-auth.md)** — full middleware
   pipeline, boot/plugin/auth taps, built-in plugins + authenticators.
5. **[Retries, delay & pooling](slice-5-retries-delay-pooling.md)** — retry loop in
   `send`, `integerStore` + delay middleware, concurrency pool.
6. **[Faking](slice-6-faking.md)** — `createMockClient`, `mockResponse`, fixtures,
   identity tagging; retrofit earlier tests to the mock client.
7. **[OAuth2 & DTOs](slice-7-oauth2-dtos.md)** — both grants, token store, DTO
   wire-through.
8. **[Polish & release](slice-8-polish.md)** — curated barrel, tree-shaking proof,
   README, examples, CI, release prep.

Cross-cutting API decisions live in [api-style.md](api-style.md).

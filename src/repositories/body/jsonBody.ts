// Port of ../saloon/src/Repositories/Body/JsonBodyRepository.php
//
// A mergeable array body serialized as JSON. Mirrors PHP's ArrayBodyRepository:
// `merge` is `array_merge` (later/request keys win); `isEmpty` is `empty($data)`
// (empty only when keyless — a `0` value does not make it empty).

import type { BodyRepository } from '@/contracts/BodyRepository';
import type { MergeableBody } from '@/contracts/MergeableBody';

export type JsonData = Record<string, unknown>;
export type JsonBody = BodyRepository<JsonData> & MergeableBody;

export function jsonBody(data: JsonData = {}): JsonBody {
  let store: JsonData = { ...data };

  const api: JsonBody = {
    kind: 'json',
    set(value) {
      store = { ...value };
      return api;
    },
    all: () => ({ ...store }),
    isEmpty: () => Object.keys(store).length === 0,
    clone: () => jsonBody(store),
    merge(value) {
      store = { ...store, ...(value as JsonData) };
      return api;
    },
    toRequestBody: () => ({ body: JSON.stringify(store), contentType: 'application/json' }),
  };

  return api;
}

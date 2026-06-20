// Port of ../saloon/src/Repositories/Body/StringBodyRepository.php
//
// A raw string body with an explicit content type. NOT mergeable (no `merge`) — on
// a connector/request clash the request body wins wholesale. `isEmpty` follows PHP
// `empty()`, so `''`, `null` and the quirky `'0'` all count as empty.

import type { BodyRepository } from '@/contracts/BodyRepository';
import { isEmptyString } from '@/repositories/body/phpEmpty';

export type StringBody = BodyRepository<string | null>;

export function stringBody(value: string | null = null, contentType?: string): StringBody {
  let store: string | null = value;

  const api: StringBody = {
    kind: 'string',
    set(v) {
      store = v;
      return api;
    },
    all: () => store,
    isEmpty: () => isEmptyString(store),
    clone: () => stringBody(store, contentType),
    toRequestBody: () => ({ body: store ?? '', contentType: contentType ?? null }),
  };

  return api;
}

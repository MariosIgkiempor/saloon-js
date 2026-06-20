// Port of ../saloon/src/Repositories/Body/FormBodyRepository.php
//
// A mergeable array body serialized as `application/x-www-form-urlencoded` (PHP's
// `http_build_query`). Same array semantics as the JSON body; only the wire format
// and content type differ.

import type { BodyRepository } from '@/contracts/BodyRepository';
import type { MergeableBody } from '@/contracts/MergeableBody';

export type FormData = Record<string, string | number | boolean>;
export type FormBody = BodyRepository<FormData> & MergeableBody;

export function formBody(data: FormData = {}): FormBody {
  let store: FormData = { ...data };

  const api: FormBody = {
    kind: 'form',
    set(value) {
      store = { ...value };
      return api;
    },
    all: () => ({ ...store }),
    isEmpty: () => Object.keys(store).length === 0,
    clone: () => formBody(store),
    merge(value) {
      store = { ...store, ...(value as FormData) };
      return api;
    },
    toRequestBody() {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(store)) {
        params.set(key, String(value));
      }
      return { body: params, contentType: 'application/x-www-form-urlencoded' };
    },
  };

  return api;
}

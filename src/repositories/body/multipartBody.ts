// Port of ../saloon/src/Repositories/Body/MultipartBodyRepository.php
//
// A mergeable list of multipart fields. PHP stores `MultipartValue[]` and its
// `merge` is `array_merge` over numerically-indexed arrays — i.e. concatenation,
// not dedupe-by-name. `toRequestBody` returns `contentType: null` so fetch sets the
// `multipart/form-data; boundary=…` header itself.
//
// Note: fetch's `FormData` has no per-part header support, so a field's `headers`
// are not transmitted (a platform limitation, not present in PHP/Guzzle).

import type { BodyRepository } from '@/contracts/BodyRepository';
import type { MergeableBody } from '@/contracts/MergeableBody';
import type { MultipartValue } from '@/contracts/MultipartValue';

export interface MultipartBody extends BodyRepository<MultipartValue[]>, MergeableBody {
  /** Build and attach a `MultipartValue`. Chainable. */
  add(
    name: string,
    contents: string | Blob,
    filename?: string,
    headers?: Record<string, string>,
  ): MultipartBody;
  /** Append a pre-built `MultipartValue`. Chainable. */
  attach(value: MultipartValue): MultipartBody;
}

export function multipartBody(values: MultipartValue[] = []): MultipartBody {
  let store: MultipartValue[] = [...values];

  const api: MultipartBody = {
    kind: 'multipart',
    set(value) {
      store = [...value];
      return api;
    },
    all: () => [...store],
    isEmpty: () => store.length === 0,
    clone: () => multipartBody(store),
    merge(value) {
      store = [...store, ...(value as MultipartValue[])];
      return api;
    },
    add(name, contents, filename, headers) {
      const value: MultipartValue = { name, value: contents };
      if (filename !== undefined) value.filename = filename;
      if (headers !== undefined) value.headers = headers;
      return api.attach(value);
    },
    attach(value) {
      store = [...store, value];
      return api;
    },
    toRequestBody() {
      const form = new FormData();
      for (const part of store) {
        if (part.value instanceof Blob && part.filename !== undefined) {
          form.append(part.name, part.value, part.filename);
        } else {
          form.append(part.name, part.value);
        }
      }
      return { body: form, contentType: null };
    },
  };

  return api;
}

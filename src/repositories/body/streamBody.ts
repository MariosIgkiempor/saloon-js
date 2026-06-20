// Port of ../saloon/src/Repositories/Body/StreamBodyRepository.php
//
// Wraps a `ReadableStream`/`Blob` for upload with an explicit content type. NOT
// mergeable. `isEmpty` is `is_null($stream)` — only a missing stream is empty.

import type { BodyRepository } from '@/contracts/BodyRepository';

export type StreamValue = ReadableStream | Blob;
export type StreamBody = BodyRepository<StreamValue | null>;

export function streamBody(value: StreamValue | null = null, contentType?: string): StreamBody {
  let store: StreamValue | null = value;

  const api: StreamBody = {
    kind: 'stream',
    set(v) {
      store = v;
      return api;
    },
    all: () => store,
    isEmpty: () => store === null,
    clone: () => streamBody(store, contentType),
    toRequestBody: () => ({ body: store ?? '', contentType: contentType ?? null }),
  };

  return api;
}

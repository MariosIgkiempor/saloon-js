// Port of ../saloon/src/Contracts/Body/MergeableBody.php
//
// Body types that can be merged connector→request (json/form/multipart). String
// and stream bodies deliberately do NOT implement this — they cannot be merged, so
// the request body wins wholesale.

import type { BodyRepository } from '@/contracts/BodyRepository';

export interface MergeableBody {
  /** Merge another body's data in; later (request) values win. Chainable. */
  merge(value: unknown): BodyRepository;
}

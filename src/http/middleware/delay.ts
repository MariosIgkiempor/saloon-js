// Port of ../saloon/src/Http/Middleware/DelayMiddleware.php
//
// Registered last in the request pipeline: if `pending.delay` is not empty (PHP
// `empty()` — null/0 are both "no delay"), await it before the sender runs. The
// delay is in milliseconds; `sleep` is fake-timer friendly for tests.

import { sleep } from '@/helpers/sleep';
import type { PendingRequest } from '@/http/pendingRequest';

export async function delayMiddleware(pending: PendingRequest): Promise<void> {
  if (pending.delay.isNotEmpty()) {
    await sleep(pending.delay.get() as number);
  }
}

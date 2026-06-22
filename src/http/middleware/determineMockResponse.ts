// Port of ../saloon/src/Http/Middleware/DetermineMockResponse.php
//
// A request pipe: when a mock client is active, resolve the next fake for this
// pending request. A `FakeResponse` is stashed straight onto the pending (the
// `send` mock branch turns it into a Response). A `Fixture` either replays from
// disk, or — in record mode (no file yet) — lets the real request run and registers
// a response pipe that persists the live response back to disk.

import { isFixture } from '@/contracts/Fixture';
import { PipeOrder } from '@/enums';
import type { PendingRequest } from '@/http/pendingRequest';

export async function determineMockResponse(pending: PendingRequest): Promise<void> {
  const mockClient = pending.getMockClient();
  if (!mockClient) return;

  const guessed = mockClient.guessNextResponse(pending);

  if (!isFixture(guessed)) {
    pending.setFakeResponse(guessed);
    return;
  }

  const replay = await guessed.getMockResponse();
  if (replay) {
    pending.setFakeResponse(replay);
    return;
  }

  // Record mode: the real request runs; persist its response once it returns.
  pending.middleware.onResponse(
    async (response) => {
      await guessed.store(response);
    },
    'recordFixture',
    PipeOrder.Last,
  );
}

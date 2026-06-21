// Port of ../saloon/src/Contracts/Data/RecordedResponse.php + the Fixture surface
// of ../saloon/src/Http/Faking/Fixture.php (the contract only; the factory lives in
// `src/faking/fixture.ts`).
//
// A fixture records a live response to disk once, then replays it offline. Like
// `FakeResponse` it carries a symbol brand so the mock client can tell a fixture
// value apart from a plain fake at runtime.

import type { FakeResponse } from '@/contracts/FakeResponse';
import type { Response } from '@/contracts/Response';

/** Brand marking an object as a `Fixture`. */
export const FIXTURE_BRAND: unique symbol = Symbol('saloon.fixture');

export interface Fixture {
  readonly [FIXTURE_BRAND]: true;
  /** The (sanitized) fixture name, e.g. `users/ada`. */
  readonly name: string;
  /** The stored fake response, or `null` when the fixture has not been recorded yet. */
  getMockResponse(): Promise<FakeResponse | null>;
  /** Persist a freshly-recorded live response to disk (record mode). */
  store(response: Response): Promise<void>;
}

export function isFixture(value: unknown): value is Fixture {
  return typeof value === 'object' && value !== null && FIXTURE_BRAND in value;
}

import { expect } from 'vitest';
import { isOk, type Result } from '@/result';

/** Assert a `Result` is `Ok` and return its value — keeps body-reading tests terse. */
export function expectOk<T, E>(result: Result<T, E>): T {
  expect(isOk(result)).toBe(true);
  if (!isOk(result)) throw new Error('Expected an Ok result');
  return result.value;
}

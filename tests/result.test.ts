import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, ok, type Result } from '@/result';

describe('Result', () => {
  it('ok carries a value and narrows via isOk', () => {
    const result: Result<number, string> = ok(42);
    expect(result.ok).toBe(true);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    }
  });

  it('err carries an error and narrows via isErr', () => {
    const result: Result<number, string> = err('boom');
    expect(result.ok).toBe(false);
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    if (isErr(result)) {
      expect(result.error).toBe('boom');
    }
  });
});

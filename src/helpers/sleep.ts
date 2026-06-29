// A promisified `setTimeout`. Used by the retry loop (between attempts) and the
// delay middleware. Kept trivial so test fake-timers (`vi.useFakeTimers`) can drive
// it deterministically. A non-positive duration resolves on the next microtask.

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

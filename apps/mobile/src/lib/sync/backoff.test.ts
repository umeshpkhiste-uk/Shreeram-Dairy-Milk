import { backoffDelayMs, nextAttemptAt } from './backoff';

describe('backoffDelayMs', () => {
  it('is zero before the first attempt', () => {
    expect(backoffDelayMs(0)).toBe(0);
  });

  it('doubles with each attempt', () => {
    expect(backoffDelayMs(1)).toBe(5_000);
    expect(backoffDelayMs(2)).toBe(10_000);
    expect(backoffDelayMs(3)).toBe(20_000);
  });

  it('is bounded at 15 minutes', () => {
    expect(backoffDelayMs(20)).toBe(15 * 60_000);
  });
});

describe('nextAttemptAt', () => {
  it('adds the backoff delay to the given time', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const result = nextAttemptAt(1, from);
    expect(result).toBe('2026-01-01T00:00:05.000Z');
  });
});

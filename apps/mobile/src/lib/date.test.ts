import { lastOfMonth } from './date';

describe('lastOfMonth', () => {
  it('returns the 30-day month end', () => {
    expect(lastOfMonth('2026-11-01')).toBe('2026-11-30');
  });

  it('returns the 31-day month end from any day in that month', () => {
    expect(lastOfMonth('2026-10-28')).toBe('2026-10-31');
  });

  it('handles February in a leap year', () => {
    expect(lastOfMonth('2028-02-01')).toBe('2028-02-29');
  });
});

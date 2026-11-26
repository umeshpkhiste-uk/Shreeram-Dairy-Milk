import { formatDate, formatDateTime, formatDateWithWeekday } from './date';

describe('date formats', () => {
  it('shows every single date as DD/MM/YYYY', () => {
    expect(formatDate('2026-11-05')).toBe('05/11/2026');
    expect(formatDateWithWeekday('2026-11-27')).toBe('Friday, 27/11/2026');
  });

  it('shows a moment in India time', () => {
    // 18:08 UTC is 23:38 in India.
    expect(formatDateTime('2026-11-27T18:08:00Z')).toMatch(/^27\/11\/2026, 11:38\s?pm$/i);
    // 20:00 UTC is already the next day in India.
    expect(formatDateTime('2026-11-27T20:00:00Z')).toMatch(/^28\/11\/2026, 1:30\s?am$/i);
  });
});

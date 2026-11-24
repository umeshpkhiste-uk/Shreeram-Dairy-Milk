import { lastOfMonth, shiftDate } from '@shreeram/shared';

/** Weeks of date strings for the given month, padded with null for alignment. */
export function buildMonthGrid(monthFirstDate: string): (string | null)[][] {
  const daysInMonth = Number(lastOfMonth(monthFirstDate).slice(8));
  const firstWeekday = new Date(`${monthFirstDate}T00:00:00Z`).getUTCDay();

  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => shiftDate(monthFirstDate, i)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

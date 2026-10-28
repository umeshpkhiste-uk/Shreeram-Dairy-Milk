/** The business day in Asia/Kolkata — docs/architecture.md rule 9. */
export function todayInBusinessTimezone(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** First-of-month helper for billing periods. `date` is any YYYY-MM-DD; always returns the 1st. */
export function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function shiftMonth(firstOfMonthDate: string, deltaMonths: number): string {
  const d = new Date(`${firstOfMonthDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + deltaMonths);
  return d.toISOString().slice(0, 10);
}

/** Last day (YYYY-MM-DD) of the month containing `firstOfMonthDate` (any day of that month works). */
export function lastOfMonth(firstOfMonthDate: string): string {
  const d = new Date(`${firstOfMonth(firstOfMonthDate)}T00:00:00Z`);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return last.toISOString().slice(0, 10);
}

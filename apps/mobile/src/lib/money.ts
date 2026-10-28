/**
 * Money is always stored as integer paise (1/100 INR) — never floating
 * point. These helpers are the only place paise <-> rupee conversion
 * happens for display/input, so rounding behaviour stays consistent.
 */

export function formatPaiseAsRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toFixed(2)}`;
}

/** Parses a rupee amount typed by a user (e.g. "55" or "55.50") into integer paise. */
export function parseRupeesToPaise(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  return Math.round(Number(trimmed) * 100);
}

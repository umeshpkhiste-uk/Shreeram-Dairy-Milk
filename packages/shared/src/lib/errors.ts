import { formatDate } from './date';

/**
 * The message to show for a failed save. Database errors arrive as plain
 * objects, not Error instances. Only reasons written for people are shown:
 * P0001 is our own `raise exception` in an RPC. Any other database error is
 * technical text, so the caller's fallback is shown instead.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return withDates(err.message);
  const { code, message } = (err ?? {}) as { code?: string; message?: string };
  if (code === 'P0001' && message) return withDates(message);
  if (code === '23505') return `${fallback} An entry with the same details already exists.`;
  return fallback;
}

/** The database writes dates as 2026-11-27; people see them as 27/11/2026. */
function withDates(message: string): string {
  return message.replace(/\b\d{4}-\d{2}-\d{2}\b/g, formatDate);
}

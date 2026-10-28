/**
 * Bounded exponential backoff for retrying a failed outbox upload.
 * Pure function — unit-testable without SQLite or a network.
 */

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 15 * 60_000; // 15 minutes

export function backoffDelayMs(attemptCount: number): number {
  if (attemptCount <= 0) return 0;
  const exponential = BASE_DELAY_MS * 2 ** (attemptCount - 1);
  return Math.min(exponential, MAX_DELAY_MS);
}

export function nextAttemptAt(attemptCount: number, from: Date = new Date()): string {
  return new Date(from.getTime() + backoffDelayMs(attemptCount)).toISOString();
}

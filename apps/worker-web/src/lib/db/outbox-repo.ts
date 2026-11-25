import { db, type OutboxItem } from './db';

/**
 * Every not-yet-acknowledged outbox row, oldest first — never deleted until acknowledged.
 * Includes failed ones, whose next_attempt_at is hours away: the server may accept them later.
 */
export async function listUnsentOutboxItems(): Promise<OutboxItem[]> {
  return db.sync_outbox.where('status').anyOf('pending', 'in_flight', 'failed').sortBy('created_at');
}

export async function countPendingOutboxItems(): Promise<number> {
  return db.sync_outbox.where('status').anyOf('pending', 'in_flight').count();
}

export async function countFailedOutboxItems(): Promise<number> {
  return db.sync_outbox.where('status').equals('failed').count();
}

export async function listOutboxItems(): Promise<OutboxItem[]> {
  return db.sync_outbox.orderBy('created_at').reverse().toArray();
}

export async function markOutboxInFlight(eventId: string) {
  await db.sync_outbox.update(eventId, { status: 'in_flight' });
}

/** The server has acknowledged this event (applied or duplicate) — done. */
export async function markOutboxDone(eventId: string) {
  await db.sync_outbox.update(eventId, { status: 'done' });
}

/** A conflict is terminal for this event too — the server already recorded and flagged it; retrying won't resolve it. */
export async function markOutboxConflict(eventId: string) {
  await db.sync_outbox.update(eventId, { status: 'done' });
}

/** A transient failure (network/server error) — reschedule with backoff, never delete. */
export async function rescheduleOutboxItem(eventId: string, nextAttemptAt: string, error: string) {
  await db.sync_outbox
    .where('event_id')
    .equals(eventId)
    .modify((item) => {
      item.status = 'pending';
      item.attempt_count += 1;
      item.next_attempt_at = nextAttemptAt;
      item.last_error = error;
    });
}

const FAILED_RETRY_MS = 6 * 60 * 60 * 1000;

/** The server refused it (e.g. unauthorized customer, invalid data) — surface for review, try again in hours. */
export async function markOutboxFailed(eventId: string, error: string) {
  await db.sync_outbox.update(eventId, {
    status: 'failed',
    last_error: error,
    next_attempt_at: new Date(Date.now() + FAILED_RETRY_MS).toISOString(),
  });
}

/** Manual retry: move a failed item back to pending, due immediately. */
export async function retryFailedOutboxItem(eventId: string) {
  await db.sync_outbox.update(eventId, {
    status: 'pending',
    next_attempt_at: new Date().toISOString(),
  });
}

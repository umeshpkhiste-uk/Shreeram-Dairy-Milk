import { getDb } from './db';

export type OutboxStatus = 'pending' | 'in_flight' | 'done' | 'failed';

export type OutboxItem = {
  event_id: string;
  delivery_id: string;
  event_type: 'created' | 'corrected';
  payload: string; // JSON — see deliveries-repo.ts for the shape
  attempt_count: number;
  next_attempt_at: string;
  last_error: string | null;
  status: OutboxStatus;
  created_at: string;
};

/** Outbox rows due for an upload attempt now, oldest first — never deleted until acknowledged. */
export function listDueOutboxItems(now: string = new Date().toISOString()): OutboxItem[] {
  return getDb().getAllSync<OutboxItem>(
    `select * from sync_outbox
     where status in ('pending', 'in_flight') and next_attempt_at <= ?
     order by created_at asc`,
    [now],
  );
}

export function countPendingOutboxItems(): number {
  const row = getDb().getFirstSync<{ count: number }>(
    "select count(*) as count from sync_outbox where status in ('pending', 'in_flight')",
  );
  return row?.count ?? 0;
}

export function countFailedOutboxItems(): number {
  const row = getDb().getFirstSync<{ count: number }>(
    "select count(*) as count from sync_outbox where status = 'failed'",
  );
  return row?.count ?? 0;
}

export function listOutboxItems(): OutboxItem[] {
  return getDb().getAllSync<OutboxItem>('select * from sync_outbox order by created_at desc');
}

export function markOutboxInFlight(eventId: string) {
  getDb().runSync("update sync_outbox set status = 'in_flight' where event_id = ?", [eventId]);
}

/** The server has acknowledged this event (applied, duplicate, or a validation rejection it won't retry) — done. */
export function markOutboxDone(eventId: string) {
  getDb().runSync("update sync_outbox set status = 'done' where event_id = ?", [eventId]);
}

/** A conflict is terminal for this event too — the server already recorded and flagged it; retrying won't resolve it. */
export function markOutboxConflict(eventId: string) {
  getDb().runSync("update sync_outbox set status = 'done' where event_id = ?", [eventId]);
}

/** A transient failure (network/server error) — reschedule with backoff, never delete. */
export function rescheduleOutboxItem(eventId: string, nextAttemptAt: string, error: string) {
  getDb().runSync(
    `update sync_outbox
     set status = 'pending', attempt_count = attempt_count + 1, next_attempt_at = ?, last_error = ?
     where event_id = ?`,
    [nextAttemptAt, error, eventId],
  );
}

/** A permanent rejection (e.g. unauthorized customer, invalid data) — stop retrying, surface for manual review. */
export function markOutboxFailed(eventId: string, error: string) {
  getDb().runSync("update sync_outbox set status = 'failed', last_error = ? where event_id = ?", [
    error,
    eventId,
  ]);
}

/** Manual retry: move a failed item back to pending, due immediately. */
export function retryFailedOutboxItem(eventId: string) {
  getDb().runSync(
    "update sync_outbox set status = 'pending', next_attempt_at = ? where event_id = ?",
    [new Date().toISOString(), eventId],
  );
}

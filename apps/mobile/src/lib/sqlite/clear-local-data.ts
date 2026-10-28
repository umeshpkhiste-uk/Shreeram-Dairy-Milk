import { getDb } from './db';

/**
 * Wipes every locally-cached/queued table. Called on sign-out so a second
 * account signing in on the same device (a different worker, or the same
 * worker after reactivation) never sees a previous session's cached
 * customers, delivery drafts, or sync outbox — see docs/security-review.md,
 * "Local data retention and logout behaviour".
 *
 * Does NOT reset `PRAGMA user_version` — the schema itself is unchanged,
 * only its rows.
 */
export function clearAllLocalData(): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.execSync('delete from sync_outbox');
    db.execSync('delete from local_deliveries');
    db.execSync('delete from cached_customers');
    db.execSync('delete from cached_milk_types');
    db.execSync('delete from sync_meta');
  });
}

import { db } from './db';

/**
 * Wipes every locally-cached/queued table, so a second account signing in on
 * the same device never sees a previous worker's cached customers, deliveries,
 * or outbox — see docs/security-review.md, "Local data retention and logout
 * behaviour".
 */
export async function clearAllLocalData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}

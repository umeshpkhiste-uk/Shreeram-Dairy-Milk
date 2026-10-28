import * as SQLite from 'expo-sqlite';

import { DATABASE_NAME, LATEST_VERSION, MIGRATIONS } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Lazily-opened module-level singleton, same pattern as the Supabase client
 * singleton in src/lib/supabase/client.ts — importable from the sync engine
 * outside any React render.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DATABASE_NAME);
    migrate(db);
  }
  return db;
}

function migrate(database: SQLite.SQLiteDatabase) {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    database.withTransactionSync(() => {
      for (const statement of migration.statements) {
        database.execSync(statement);
      }
      database.execSync(`PRAGMA user_version = ${migration.version}`);
    });
  }

  if (currentVersion > LATEST_VERSION) {
    throw new Error(
      `Local database version ${currentVersion} is newer than the app supports (${LATEST_VERSION}). Update the app.`,
    );
  }
}

/**
 * Local SQLite schema — a cache + durable outbox, never a second source of
 * truth (see docs/architecture.md, rule 3). Versioned migrations gated by
 * `PRAGMA user_version`, per the expo-sqlite docs' recommended pattern.
 */

export const DATABASE_NAME = 'shreeram_daily_milk.db';

type Migration = { version: number; statements: string[] };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `create table cached_customers (
        id text primary key,
        full_name text not null,
        mobile_number text not null,
        address text not null,
        locality text,
        milk_type_id text not null,
        default_daily_quantity_ml integer not null,
        route_sequence integer,
        preferred_delivery_window text
      );`,
      `create table cached_milk_types (
        id text primary key,
        name text not null
      );`,
      // One row per (customer_id, delivery_date) locally, mirroring the
      // server's uniqueness rule. delivery_id is the client-generated id
      // that also identifies the row server-side once synced.
      `create table local_deliveries (
        delivery_id text primary key,
        customer_id text not null,
        delivery_date text not null,
        milk_type_id text not null,
        scheduled_quantity_ml integer not null,
        delivered_quantity_ml integer not null,
        status text not null,
        reason text,
        device_recorded_at text not null,
        version integer not null default 1,
        sync_status text not null default 'pending',
        last_sync_error text,
        updated_at text not null
      );`,
      `create unique index local_deliveries_customer_date_idx
        on local_deliveries (customer_id, delivery_date);`,
      // The durable outbox. Survives app restarts/crashes because it's
      // written to SQLite synchronously in the same call that saves the
      // delivery — never held only in memory.
      `create table sync_outbox (
        event_id text primary key,
        delivery_id text not null,
        event_type text not null,
        payload text not null,
        attempt_count integer not null default 0,
        next_attempt_at text not null,
        last_error text,
        status text not null default 'pending',
        created_at text not null
      );`,
      `create table sync_meta (
        key text primary key,
        value text not null
      );`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

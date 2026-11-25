import Dexie, { type EntityTable, type Table } from 'dexie';

import type { Database, DeliveryStatus, ExtraProduct, ProductUnit } from '@shreeram/shared';

/**
 * Local IndexedDB — a cache + durable outbox, never a second source of truth
 * (docs/architecture.md, rule 3). Same tables as
 * apps/mobile/src/lib/sqlite/schema.ts; `sync_meta` holds the signed-in
 * worker's profile and the last sync time, so the app opens with no network.
 */

export type CachedCustomer = {
  id: string;
  full_name: string;
  mobile_number: string;
  address: string;
  locality: string | null;
  milk_type_id: string;
  default_daily_quantity_ml: number;
  /** Missing on rows cached before multiple products. */
  extra_products?: ExtraProduct[];
  route_sequence: number | null;
  preferred_delivery_window: string | null;
};

/** `unit` is missing on rows cached before products had units. */
export type CachedMilkType = { id: string; name: string; unit?: ProductUnit };

export type LocalDeliverySyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export type LocalDelivery = {
  delivery_id: string;
  customer_id: string;
  delivery_date: string;
  milk_type_id: string;
  scheduled_quantity_ml: number;
  delivered_quantity_ml: number;
  status: DeliveryStatus;
  reason: string | null;
  device_recorded_at: string;
  version: number;
  sync_status: LocalDeliverySyncStatus;
  last_sync_error: string | null;
  updated_at: string;
};

export type OutboxStatus = 'pending' | 'in_flight' | 'done' | 'failed';

export type OutboxPayload = {
  customerId: string;
  milkTypeId: string;
  deliveryDate: string;
  status: DeliveryStatus;
  deliveredQuantityMl: number;
  reason: string | null;
  expectedVersion: number | null;
  deviceRecordedAt: string;
};

export type OutboxItem = {
  event_id: string;
  delivery_id: string;
  event_type: 'created' | 'corrected';
  payload: OutboxPayload;
  attempt_count: number;
  next_attempt_at: string;
  last_error: string | null;
  status: OutboxStatus;
  created_at: string;
};

export type Profile = Database['public']['Tables']['profiles']['Row'];

type MetaRow = { key: 'profile'; value: Profile } | { key: 'lastSyncedAt'; value: string };

class WorkerDb extends Dexie {
  cached_customers!: EntityTable<CachedCustomer, 'id'>;
  cached_milk_types!: EntityTable<CachedMilkType, 'id'>;
  local_deliveries!: EntityTable<LocalDelivery, 'delivery_id'>;
  sync_outbox!: EntityTable<OutboxItem, 'event_id'>;
  sync_meta!: Table<MetaRow, string>;

  constructor() {
    // Chrome's default "relaxed" durability can lose a committed write if the
    // phone dies right after it — a marked delivery must survive that.
    super('shreeram_daily_milk', { chromeTransactionDurability: 'strict' });
    this.version(1).stores({
      cached_customers: 'id',
      cached_milk_types: 'id',
      local_deliveries: 'delivery_id, &[customer_id+delivery_date], delivery_date',
      sync_outbox: 'event_id, delivery_id, status, created_at',
      sync_meta: 'key',
    });
    // One record per customer, day and product. Rows and the outbox are kept.
    this.version(2).stores({
      local_deliveries:
        'delivery_id, &[customer_id+delivery_date+milk_type_id], [customer_id+delivery_date], delivery_date',
    });
  }
}

export const db = new WorkerDb();

export async function getProfile(): Promise<Profile | null> {
  const row = await db.sync_meta.get('profile');
  return row?.key === 'profile' ? row.value : null;
}

export async function setProfile(profile: Profile) {
  await db.sync_meta.put({ key: 'profile', value: profile });
}

export async function getLastSyncedAt(): Promise<string | null> {
  const row = await db.sync_meta.get('lastSyncedAt');
  return row?.key === 'lastSyncedAt' ? row.value : null;
}

export async function setLastSyncedAt(value: string) {
  await db.sync_meta.put({ key: 'lastSyncedAt', value });
}

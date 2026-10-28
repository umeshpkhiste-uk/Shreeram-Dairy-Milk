import * as Crypto from 'expo-crypto';

import type { DeliveryStatus } from '@/types/database';

import { getDb } from './db';

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

export type RecordDeliveryInput = {
  customerId: string;
  deliveryDate: string;
  milkTypeId: string;
  scheduledQuantityMl: number;
  deliveredQuantityMl: number;
  status: DeliveryStatus;
  reason: string | null;
};

/**
 * Saves a delivery to SQLite and enqueues the matching outbox event in one
 * transaction — the two are never out of sync, and this never waits on the
 * network (see docs/reference/Implementation Checklist.rtf, Stage 3 §B/C).
 * Creating the first record for a customer+date is a "created" event;
 * editing an already-recorded one is a "corrected" event carrying the
 * version it was based on, for server-side optimistic-concurrency conflict
 * detection.
 */
export function recordDelivery(input: RecordDeliveryInput): LocalDelivery {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.getFirstSync<LocalDelivery>(
    'select * from local_deliveries where customer_id = ? and delivery_date = ?',
    [input.customerId, input.deliveryDate],
  );

  const eventId = Crypto.randomUUID();
  const deliveryId = existing?.delivery_id ?? Crypto.randomUUID();
  const eventType = existing ? 'corrected' : 'created';
  const nextVersion = existing ? existing.version : 1;

  const delivery: LocalDelivery = {
    delivery_id: deliveryId,
    customer_id: input.customerId,
    delivery_date: input.deliveryDate,
    milk_type_id: input.milkTypeId,
    scheduled_quantity_ml: input.scheduledQuantityMl,
    delivered_quantity_ml: input.deliveredQuantityMl,
    status: input.status,
    reason: input.reason,
    device_recorded_at: now,
    version: nextVersion,
    sync_status: 'pending',
    last_sync_error: null,
    updated_at: now,
  };

  db.withTransactionSync(() => {
    db.runSync(
      `insert into local_deliveries
        (delivery_id, customer_id, delivery_date, milk_type_id, scheduled_quantity_ml,
         delivered_quantity_ml, status, reason, device_recorded_at, version,
         sync_status, last_sync_error, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', null, ?)
       on conflict (customer_id, delivery_date) do update set
         delivered_quantity_ml = excluded.delivered_quantity_ml,
         status = excluded.status,
         reason = excluded.reason,
         device_recorded_at = excluded.device_recorded_at,
         sync_status = 'pending',
         last_sync_error = null,
         updated_at = excluded.updated_at`,
      [
        delivery.delivery_id,
        delivery.customer_id,
        delivery.delivery_date,
        delivery.milk_type_id,
        delivery.scheduled_quantity_ml,
        delivery.delivered_quantity_ml,
        delivery.status,
        delivery.reason,
        delivery.device_recorded_at,
        delivery.version,
        delivery.updated_at,
      ],
    );

    db.runSync(
      `insert into sync_outbox
        (event_id, delivery_id, event_type, payload, attempt_count, next_attempt_at, status, created_at)
       values (?, ?, ?, ?, 0, ?, 'pending', ?)`,
      [
        eventId,
        deliveryId,
        eventType,
        JSON.stringify({
          customerId: input.customerId,
          milkTypeId: input.milkTypeId,
          deliveryDate: input.deliveryDate,
          status: input.status,
          deliveredQuantityMl: input.deliveredQuantityMl,
          reason: input.reason,
          expectedVersion: eventType === 'corrected' ? nextVersion : null,
          deviceRecordedAt: now,
        }),
        now,
        now,
      ],
    );
  });

  return delivery;
}

export function listLocalDeliveriesForDate(deliveryDate: string): LocalDelivery[] {
  return getDb().getAllSync<LocalDelivery>(
    'select * from local_deliveries where delivery_date = ?',
    [deliveryDate],
  );
}

/** All local records for one customer within an inclusive date range — used by the worker's per-customer calendar. */
export function listLocalDeliveriesForCustomerInRange(
  customerId: string,
  startDate: string,
  endDate: string,
): LocalDelivery[] {
  return getDb().getAllSync<LocalDelivery>(
    'select * from local_deliveries where customer_id = ? and delivery_date >= ? and delivery_date <= ?',
    [customerId, startDate, endDate],
  );
}

export function listLocalDeliveriesSince(sinceDate: string): LocalDelivery[] {
  return getDb().getAllSync<LocalDelivery>(
    'select * from local_deliveries where delivery_date >= ? order by delivery_date desc',
    [sinceDate],
  );
}

export type ServerDelivery = {
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
  has_conflict: boolean;
};

/**
 * Applies a delivery as the server currently has it — used to reconcile
 * after a pull. Never overwrites a local row that's still `pending` (not
 * yet synced): the worker's unsynced edit always wins until it's uploaded.
 */
export function applyServerDelivery(d: ServerDelivery) {
  const db = getDb();
  const local = db.getFirstSync<LocalDelivery>(
    'select * from local_deliveries where delivery_id = ?',
    [d.delivery_id],
  );
  if (local && local.sync_status === 'pending') return;

  const now = new Date().toISOString();
  db.runSync(
    `insert into local_deliveries
      (delivery_id, customer_id, delivery_date, milk_type_id, scheduled_quantity_ml,
       delivered_quantity_ml, status, reason, device_recorded_at, version,
       sync_status, last_sync_error, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, ?)
     on conflict (customer_id, delivery_date) do update set
       delivery_id = excluded.delivery_id,
       delivered_quantity_ml = excluded.delivered_quantity_ml,
       status = excluded.status,
       reason = excluded.reason,
       version = excluded.version,
       sync_status = excluded.sync_status,
       last_sync_error = null,
       updated_at = excluded.updated_at`,
    [
      d.delivery_id,
      d.customer_id,
      d.delivery_date,
      d.milk_type_id,
      d.scheduled_quantity_ml,
      d.delivered_quantity_ml,
      d.status,
      d.reason,
      d.device_recorded_at,
      d.version,
      d.has_conflict ? 'conflict' : 'synced',
      now,
    ],
  );
}

export function updateLocalDeliverySyncStatus(
  deliveryId: string,
  syncStatus: LocalDeliverySyncStatus,
  lastSyncError: string | null,
) {
  getDb().runSync(
    'update local_deliveries set sync_status = ?, last_sync_error = ? where delivery_id = ?',
    [syncStatus, lastSyncError, deliveryId],
  );
}

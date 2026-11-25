import { deliveryEntrySchema, type DeliveryStatus } from '@shreeram/shared';

import { db, type LocalDelivery, type LocalDeliverySyncStatus } from './db';

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
 * Saves a delivery and enqueues the matching outbox event in one transaction
 * — the two are never out of sync, and this never waits on the network.
 * Creating the first record for a customer+date+product is a "created" event; editing
 * an already-recorded one is a "corrected" event carrying the version it was
 * based on, for server-side optimistic-concurrency conflict detection.
 */
export async function recordDelivery(input: RecordDeliveryInput): Promise<void> {
  // Anything the server's check constraints would reject must fail here, not
  // later as a permanently failed outbox item.
  deliveryEntrySchema.parse({
    status: input.status,
    deliveredQuantityMl: input.deliveredQuantityMl,
    reason: input.reason ?? undefined,
  });

  const now = new Date().toISOString();
  await db.transaction('rw', db.local_deliveries, db.sync_outbox, async () => {
    const existing = await db.local_deliveries.get({
      customer_id: input.customerId,
      delivery_date: input.deliveryDate,
      milk_type_id: input.milkTypeId,
    });
    const edited = {
      delivered_quantity_ml: input.deliveredQuantityMl,
      status: input.status,
      reason: input.reason,
      device_recorded_at: now,
      sync_status: 'pending' as const,
      last_sync_error: null,
      updated_at: now,
    };
    const delivery: LocalDelivery = existing
      ? { ...existing, ...edited }
      : {
          delivery_id: crypto.randomUUID(),
          customer_id: input.customerId,
          delivery_date: input.deliveryDate,
          milk_type_id: input.milkTypeId,
          scheduled_quantity_ml: input.scheduledQuantityMl,
          version: 1,
          ...edited,
        };

    await db.local_deliveries.put(delivery);
    await db.sync_outbox.add({
      event_id: crypto.randomUUID(),
      delivery_id: delivery.delivery_id,
      event_type: existing ? 'corrected' : 'created',
      payload: {
        customerId: input.customerId,
        milkTypeId: input.milkTypeId,
        deliveryDate: input.deliveryDate,
        status: input.status,
        deliveredQuantityMl: input.deliveredQuantityMl,
        reason: input.reason,
        expectedVersion: existing ? existing.version : null,
        deviceRecordedAt: now,
      },
      attempt_count: 0,
      next_attempt_at: now,
      last_error: null,
      status: 'pending',
      created_at: now,
    });
  });
}

export async function listLocalDeliveriesForDate(deliveryDate: string): Promise<LocalDelivery[]> {
  return db.local_deliveries.where('delivery_date').equals(deliveryDate).toArray();
}

/** All local records for one customer within an inclusive date range — used by the worker's per-customer calendar. */
export async function listLocalDeliveriesForCustomerInRange(
  customerId: string,
  startDate: string,
  endDate: string,
): Promise<LocalDelivery[]> {
  return db.local_deliveries
    .where('[customer_id+delivery_date]')
    .between([customerId, startDate], [customerId, endDate], true, true)
    .toArray();
}

export async function listLocalDeliveriesSince(sinceDate: string): Promise<LocalDelivery[]> {
  return db.local_deliveries.where('delivery_date').aboveOrEqual(sinceDate).toArray();
}

async function hasUnsentEvents(deliveryId: string): Promise<boolean> {
  const unsent = await db.sync_outbox
    .where('delivery_id')
    .equals(deliveryId)
    .filter((item) => item.status === 'pending' || item.status === 'in_flight')
    .count();
  return unsent > 0;
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
 * after a pull. Never overwrites a local row with events still in the
 * outbox: the worker's unsynced edit always wins until it's uploaded.
 */
export async function applyServerDelivery({ has_conflict, ...d }: ServerDelivery) {
  await db.transaction('rw', db.local_deliveries, db.sync_outbox, async () => {
    const local = await db.local_deliveries.get({
      customer_id: d.customer_id,
      delivery_date: d.delivery_date,
      milk_type_id: d.milk_type_id,
    });
    if (local && (await hasUnsentEvents(local.delivery_id))) return;
    // A different server id already owns this customer+date+product (unique index).
    if (local && local.delivery_id !== d.delivery_id) {
      await db.local_deliveries.delete(local.delivery_id);
    }
    await db.local_deliveries.put({
      ...d,
      sync_status: has_conflict ? 'conflict' : 'synced',
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    });
  });
}

/**
 * Records an upload's outcome on the delivery. If the worker edited it again
 * while that upload was in the air, the row stays `pending` for the newer event.
 */
export async function updateLocalDeliverySyncStatus(
  deliveryId: string,
  syncStatus: LocalDeliverySyncStatus,
  lastSyncError: string | null,
) {
  await db.transaction('rw', db.local_deliveries, db.sync_outbox, async () => {
    await db.local_deliveries.update(deliveryId, {
      sync_status: (await hasUnsentEvents(deliveryId)) ? 'pending' : syncStatus,
      last_sync_error: lastSyncError,
    });
  });
}

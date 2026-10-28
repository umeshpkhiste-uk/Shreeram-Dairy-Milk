import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { listDeliveriesForWorkerSince, submitDeliveryEvent } from '@/lib/api/deliveries';
import { listCustomersForWorker } from '@/lib/api/customers';
import { listActiveMilkTypes } from '@/lib/api/milk-types';
import { applyServerDelivery, updateLocalDeliverySyncStatus } from '@/lib/sqlite/deliveries-repo';
import {
  countFailedOutboxItems,
  countPendingOutboxItems,
  listDueOutboxItems,
  markOutboxConflict,
  markOutboxDone,
  markOutboxFailed,
  markOutboxInFlight,
  rescheduleOutboxItem,
} from '@/lib/sqlite/outbox-repo';
import { replaceCachedCustomers, replaceCachedMilkTypes } from '@/lib/sqlite/cache-repo';
import { supabase } from '@/lib/supabase/client';

import { backoffDelayMs, nextAttemptAt } from './backoff';
import { isOnlineState, onConnectivityRestored } from './connectivity';
import NetInfo from '@react-native-community/netinfo';

export type SyncStatus = {
  phase: 'idle' | 'syncing' | 'offline';
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
};

let status: SyncStatus = {
  phase: 'idle',
  pendingCount: 0,
  failedCount: 0,
  lastSyncedAt: null,
  lastError: null,
};
const listeners = new Set<(status: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener(status));
}

function refreshCounts() {
  setStatus({ pendingCount: countPendingOutboxItems(), failedCount: countFailedOutboxItems() });
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSyncStatus(): SyncStatus {
  const [value, setValue] = useState(status);
  useEffect(() => {
    refreshCounts();
    return subscribeSyncStatus(setValue);
  }, []);
  return value;
}

/** Postgres validation/authorization errors (23xxx, 22xxx, or our own raised P0001) won't succeed on retry. */
function isPermanentError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return (
    typeof code === 'string' && (code.startsWith('23') || code.startsWith('22') || code === 'P0001')
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

let syncInFlight = false;

/** Uploads every due outbox item, in order, oldest first. Never runs two syncs concurrently. */
export async function runSync(): Promise<void> {
  if (syncInFlight) return;
  syncInFlight = true;
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      refreshCounts();
      return;
    }

    const netState = await NetInfo.fetch();
    if (!isOnlineState(netState)) {
      setStatus({ phase: 'offline' });
      refreshCounts();
      return;
    }

    setStatus({ phase: 'syncing', lastError: null });

    const items = listDueOutboxItems();
    for (const item of items) {
      markOutboxInFlight(item.event_id);
      const payload = JSON.parse(item.payload) as {
        customerId: string;
        milkTypeId: string;
        deliveryDate: string;
        status: 'completed' | 'partial' | 'missed';
        deliveredQuantityMl: number;
        reason: string | null;
        expectedVersion: number | null;
        deviceRecordedAt: string;
      };

      try {
        const result = await submitDeliveryEvent({
          eventId: item.event_id,
          deliveryId: item.delivery_id,
          customerId: payload.customerId,
          milkTypeId: payload.milkTypeId,
          deliveryDate: payload.deliveryDate,
          eventType: item.event_type,
          status: payload.status,
          deliveredQuantityMl: payload.deliveredQuantityMl,
          reason: payload.reason,
          expectedVersion: payload.expectedVersion,
          deviceRecordedAt: payload.deviceRecordedAt,
        });

        if (result.conflict) {
          updateLocalDeliverySyncStatus(
            item.delivery_id,
            'conflict',
            'The server has a conflicting update for this delivery. Flagged for admin review.',
          );
          markOutboxConflict(item.event_id);
        } else {
          updateLocalDeliverySyncStatus(item.delivery_id, 'synced', null);
          markOutboxDone(item.event_id);
        }
      } catch (error) {
        const message = errorMessage(error);
        if (isPermanentError(error)) {
          updateLocalDeliverySyncStatus(item.delivery_id, 'failed', message);
          markOutboxFailed(item.event_id, message);
        } else {
          updateLocalDeliverySyncStatus(item.delivery_id, 'pending', message);
          rescheduleOutboxItem(item.event_id, nextAttemptAt(item.attempt_count + 1), message);
        }
      }
    }

    await pullLatestData(session.user.id);
    setStatus({ phase: 'idle', lastSyncedAt: new Date().toISOString() });
    refreshCounts();
  } catch (error) {
    setStatus({ phase: 'idle', lastError: errorMessage(error) });
    refreshCounts();
  } finally {
    syncInFlight = false;
  }
}

/** Refreshes the cached customer/route/milk-type list and reconciles recent deliveries from the server. */
export async function pullLatestData(workerId: string): Promise<void> {
  const [customers, milkTypes] = await Promise.all([
    listCustomersForWorker(workerId),
    listActiveMilkTypes(),
  ]);

  replaceCachedCustomers(
    customers.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      mobile_number: c.mobile_number,
      address: c.address,
      locality: c.locality,
      milk_type_id: c.milk_type_id,
      default_daily_quantity_ml: c.default_daily_quantity_ml,
      route_sequence: c.route_sequence,
      preferred_delivery_window: c.preferred_delivery_window,
    })),
  );
  replaceCachedMilkTypes(milkTypes.map((m) => ({ id: m.id, name: m.name })));

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 14);
  const sinceIso = sinceDate.toISOString().slice(0, 10);
  const serverDeliveries = await listDeliveriesForWorkerSince(workerId, sinceIso);
  for (const d of serverDeliveries) {
    applyServerDelivery({
      delivery_id: d.id,
      customer_id: d.customer_id,
      delivery_date: d.delivery_date,
      milk_type_id: d.milk_type_id,
      scheduled_quantity_ml: d.scheduled_quantity_ml,
      delivered_quantity_ml: d.delivered_quantity_ml,
      status: d.status,
      reason: d.reason,
      device_recorded_at: d.device_recorded_at,
      version: d.version,
      has_conflict: d.has_conflict,
    });
  }
}

let initialized = false;

/** Wires up the standard sync triggers — call once, near app startup. */
export function initSyncEngine() {
  if (initialized) return;
  initialized = true;

  runSync();

  AppState.addEventListener('change', (state) => {
    if (state === 'active') runSync();
  });

  onConnectivityRestored(() => runSync());
}

export { backoffDelayMs };

'use client';

import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

import { listCustomersForWorker } from '@/lib/api/customers';
import { listDeliveriesForWorkerSince, submitDeliveryEvent, type DeliveryRow } from '@/lib/api/deliveries';
import { listActiveMilkTypes } from '@/lib/api/milk-types';
import { getOwnProfile } from '@/lib/api/profile';
import { replaceCachedCustomers, replaceCachedMilkTypes } from '@/lib/db/cache-repo';
import { getLastSyncedAt, getProfile, setLastSyncedAt, setProfile } from '@/lib/db/db';
import { applyServerDelivery, updateLocalDeliverySyncStatus } from '@/lib/db/deliveries-repo';
import {
  countFailedOutboxItems,
  countPendingOutboxItems,
  listUnsentOutboxItems,
  markOutboxConflict,
  markOutboxDone,
  markOutboxFailed,
  markOutboxInFlight,
  rescheduleOutboxItem,
} from '@/lib/db/outbox-repo';
import { useLive } from '@/lib/db/use-live';
import { supabase } from '@/lib/supabase/client';

import { nextAttemptAt } from './backoff';

type EngineState = {
  phase: 'idle' | 'syncing' | 'offline' | 'signedOut';
  lastError: string | null;
};

export type SyncStatus = EngineState & {
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: string | null;
};

const INITIAL_STATE: EngineState = { phase: 'idle', lastError: null };
let state = INITIAL_STATE;
const listeners = new Set<() => void>();

function setState(patch: Partial<EngineState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEngineState(): EngineState {
  return state;
}

export function useSyncStatus(): SyncStatus {
  const engine = useSyncExternalStore(subscribe, getEngineState, () => INITIAL_STATE);
  const counts = useLive(
    async () => ({
      pendingCount: await countPendingOutboxItems(),
      failedCount: await countFailedOutboxItems(),
      lastSyncedAt: await getLastSyncedAt(),
    }),
    [],
  );
  return { pendingCount: 0, failedCount: 0, lastSyncedAt: null, ...counts, ...engine };
}

/** Postgres validation/authorization errors (23xxx, 22xxx, or our own raised P0001) won't succeed on retry. */
function isPermanentError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return (
    typeof code === 'string' && (code.startsWith('23') || code.startsWith('22') || code === 'P0001')
  );
}

function errorMessage(error: unknown): string {
  return (error as { message?: string } | null)?.message ?? String(error);
}

export const SYNC_LOCK = 'worker-sync';
let queued = false;

/**
 * Uploads every due outbox item, oldest first, then pulls. One at a time
 * across all open tabs (two tabs uploading the same event would collide on
 * the server's event id); a call made mid-sync runs right after it, so a
 * delivery marked meanwhile isn't left waiting for the next trigger.
 */
export async function runSync(): Promise<void> {
  if (queued) return;
  queued = true;
  await navigator.locks.request(SYNC_LOCK, async () => {
    queued = false;
    await syncOnce();
  });
}

async function syncOnce(): Promise<void> {
  try {
    if (!navigator.onLine) {
      setState({ phase: 'offline' });
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
      // A refresh that failed on a bad network is not a sign-out.
      if (error && isAuthRetryableFetchError(error)) throw error;
      setState({ phase: 'signedOut' });
      return;
    }
    // Never upload or pull one worker's data under another worker's session.
    if (userId !== (await getProfile())?.id) {
      setState({ phase: 'signedOut' });
      return;
    }

    setState({ phase: 'syncing', lastError: null });
    await drainOutbox();
    await pullLatestData(userId);
    await setLastSyncedAt(new Date().toISOString());
    setState({ phase: 'idle' });
  } catch (error) {
    setState({ phase: 'idle', lastError: errorMessage(error) });
  }
}

async function drainOutbox(): Promise<void> {
  // Once an event for a delivery has to wait, so do its later ones: a
  // correction arriving before its creation is permanently rejected.
  const waiting = new Set<string>();

  for (const item of await listUnsentOutboxItems()) {
    if (waiting.has(item.delivery_id)) continue;
    if (item.next_attempt_at > new Date().toISOString()) {
      waiting.add(item.delivery_id);
      continue;
    }

    await markOutboxInFlight(item.event_id);
    try {
      const result = await submitDeliveryEvent({
        eventId: item.event_id,
        deliveryId: item.delivery_id,
        eventType: item.event_type,
        ...item.payload,
      });

      // Outbox first: updateLocalDeliverySyncStatus keeps the row `pending`
      // while any event for it is still unsent.
      if (result.conflict) {
        await markOutboxConflict(item.event_id);
        await updateLocalDeliverySyncStatus(
          item.delivery_id,
          'conflict',
          'The server has a conflicting update for this delivery. Flagged for admin review.',
        );
      } else {
        await markOutboxDone(item.event_id);
        await updateLocalDeliverySyncStatus(item.delivery_id, 'synced', null);
      }
    } catch (error) {
      const message = errorMessage(error);
      if (isPermanentError(error)) {
        await markOutboxFailed(item.event_id, message);
        await updateLocalDeliverySyncStatus(item.delivery_id, 'failed', message);
      } else {
        waiting.add(item.delivery_id);
        await rescheduleOutboxItem(item.event_id, nextAttemptAt(item.attempt_count + 1), message);
        await updateLocalDeliverySyncStatus(item.delivery_id, 'pending', message);
      }
    }
  }
}

export async function applyServerRows(rows: DeliveryRow[]): Promise<void> {
  for (const d of rows) {
    await applyServerDelivery({
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

/** Refreshes the profile and cached customer/milk-type lists, and reconciles recent deliveries from the server. */
async function pullLatestData(workerId: string): Promise<void> {
  // The layout signs a deactivated worker out when this row says so.
  await setProfile(await getOwnProfile(workerId));

  const [customers, milkTypes] = await Promise.all([
    listCustomersForWorker(workerId),
    listActiveMilkTypes(),
  ]);

  await replaceCachedCustomers(
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
  await replaceCachedMilkTypes(milkTypes.map((m) => ({ id: m.id, name: m.name, unit: m.unit })));

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 14);
  await applyServerRows(
    await listDeliveriesForWorkerSince(workerId, sinceDate.toISOString().slice(0, 10)),
  );
}

const FRESH_MS = 60_000;

/**
 * Startup sync. Every screen is its own document load, so skip it when the
 * last sync is under a minute old and nothing is waiting — otherwise each tab
 * tap would re-pull the whole route over mobile data.
 */
async function syncIfStale(): Promise<void> {
  const lastSyncedAt = await getLastSyncedAt();
  const fresh = lastSyncedAt && Date.now() - Date.parse(lastSyncedAt) < FRESH_MS;
  if (fresh && (await countPendingOutboxItems()) === 0) return;
  await runSync();
}

let initialized = false;

/** Wires up the standard sync triggers — call once, near app startup. */
export function initSyncEngine() {
  if (initialized) return;
  initialized = true;

  syncIfStale();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runSync();
  });
  window.addEventListener('online', () => runSync());
  window.addEventListener('offline', () => setState({ phase: 'offline' }));

  navigator.storage?.persist?.().then(
    (granted) => {
      if (!granted) console.warn('Persistent storage not granted; the browser may evict local data.');
    },
    (error) => console.warn('Persistent storage request failed', error),
  );
}

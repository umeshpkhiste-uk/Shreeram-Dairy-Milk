import 'fake-indexeddb/auto';

import { listCustomersForWorker } from '@/lib/api/customers';
import { listDeliveriesForWorkerSince, submitDeliveryEvent } from '@/lib/api/deliveries';
import { getOwnProfile } from '@/lib/api/profile';
import { clearAllLocalData } from '@/lib/db/clear-local-data';
import { db, setProfile, type Profile } from '@/lib/db/db';
import { recordDelivery } from '@/lib/db/deliveries-repo';
import { supabase } from '@/lib/supabase/client';

import { getEngineState, runSync } from './sync-engine';

jest.mock('@/lib/supabase/client', () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock('@/lib/api/deliveries', () => ({
  submitDeliveryEvent: jest.fn(),
  listDeliveriesForWorkerSince: jest.fn(),
}));
jest.mock('@/lib/api/customers', () => ({ listCustomersForWorker: jest.fn() }));
jest.mock('@/lib/api/milk-types', () => ({ listActiveMilkTypes: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/api/profile', () => ({ getOwnProfile: jest.fn() }));

const submit = submitDeliveryEvent as jest.Mock;
const getSession = supabase.auth.getSession as jest.Mock;
const WORKER = { id: 'worker-1', role: 'worker', is_active: true } as Profile;
const APPLIED = { applied: true, duplicate: false, conflict: false, outcome: 'applied' };

let online = true;
let lock: Promise<unknown> = Promise.resolve();
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    get onLine() {
      return online;
    },
    // Exclusive, queued — what the Web Locks API guarantees.
    locks: {
      request: (_name: string, fn: () => Promise<unknown>) => (lock = lock.then(fn)),
    },
  },
});

const mark = async (status: 'completed' | 'missed', customerId = 'c1') => {
  // The outbox is ordered by millisecond timestamp; two taps are never in the same one.
  await new Promise((resolve) => setTimeout(resolve, 2));
  await recordDelivery({
    customerId,
    deliveryDate: '2026-11-24',
    milkTypeId: 'milk',
    scheduledQuantityMl: 1000,
    deliveredQuantityMl: status === 'completed' ? 1000 : 0,
    status,
    reason: status === 'missed' ? 'Not delivered' : null,
  });
};

const only = async () => (await db.local_deliveries.toArray())[0];
const outbox = () => db.sync_outbox.orderBy('created_at').toArray();
const makeAllDue = () => db.sync_outbox.toCollection().modify({ next_attempt_at: '2000-01-01' });

beforeEach(async () => {
  jest.resetAllMocks();
  online = true;
  await clearAllLocalData();
  await setProfile(WORKER);
  getSession.mockResolvedValue({ data: { session: { user: { id: 'worker-1' } } }, error: null });
  (getOwnProfile as jest.Mock).mockResolvedValue(WORKER);
  (listCustomersForWorker as jest.Mock).mockResolvedValue([]);
  (listDeliveriesForWorkerSince as jest.Mock).mockResolvedValue([]);
  jest.requireMock('@/lib/api/milk-types').listActiveMilkTypes.mockResolvedValue([]);
  submit.mockResolvedValue(APPLIED);
});

describe('recordDelivery', () => {
  it('saves the delivery and its outbox event together with no network call', async () => {
    online = false;
    await mark('completed');
    expect(await only()).toMatchObject({ status: 'completed', sync_status: 'pending', version: 1 });
    expect(await outbox()).toMatchObject([{ event_type: 'created', status: 'pending' }]);
    expect(submit).not.toHaveBeenCalled();
  });

  it('a second mark for the same day is a correction on the same delivery', async () => {
    await mark('missed');
    await mark('completed');
    const [created, corrected] = await outbox();
    expect(await db.local_deliveries.count()).toBe(1);
    expect(corrected).toMatchObject({
      event_type: 'corrected',
      delivery_id: created.delivery_id,
      payload: { expectedVersion: 1 },
    });
  });

  it('refuses a missed delivery with no reason, which the server would reject for good', async () => {
    await expect(
      recordDelivery({
        customerId: 'c1',
        deliveryDate: '2026-11-24',
        milkTypeId: 'milk',
        scheduledQuantityMl: 1000,
        deliveredQuantityMl: 0,
        status: 'missed',
        reason: null,
      }),
    ).rejects.toThrow();
    expect(await db.sync_outbox.count()).toBe(0);
  });
});

describe('runSync', () => {
  it('does nothing when there is no signed-in session, and keeps the queue', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await mark('completed');
    await runSync();
    expect(submit).not.toHaveBeenCalled();
    expect(getEngineState().phase).toBe('signedOut');
    expect(await outbox()).toMatchObject([{ status: 'pending' }]);
  });

  it('a session refresh that failed on the network is not treated as signed out', async () => {
    const error = Object.assign(new Error('Failed to fetch'), {
      __isAuthError: true,
      name: 'AuthRetryableFetchError',
    });
    getSession.mockResolvedValue({ data: { session: null }, error });
    await runSync();
    expect(getEngineState()).toEqual({ phase: 'idle', lastError: 'Failed to fetch' });
  });

  it("never uploads another worker's queue", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'worker-2' } } }, error: null });
    await mark('completed');
    await runSync();
    expect(submit).not.toHaveBeenCalled();
    expect(listCustomersForWorker).not.toHaveBeenCalled();
  });

  it('does nothing when offline', async () => {
    online = false;
    await mark('completed');
    await runSync();
    expect(submit).not.toHaveBeenCalled();
    expect(getEngineState().phase).toBe('offline');
  });

  it('marks a successfully applied item as synced', async () => {
    await mark('completed');
    await runSync();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(await only()).toMatchObject({ sync_status: 'synced' });
    expect(await outbox()).toMatchObject([{ status: 'done' }]);
  });

  it('a duplicate (already-synced retry) is treated as success', async () => {
    submit.mockResolvedValue({ ...APPLIED, duplicate: true });
    await mark('completed');
    await runSync();
    expect(await only()).toMatchObject({ sync_status: 'synced' });
  });

  it('flags a server-reported conflict without retrying it', async () => {
    submit.mockResolvedValue({ ...APPLIED, applied: false, conflict: true });
    await mark('completed');
    await runSync();
    expect(await only()).toMatchObject({ sync_status: 'conflict' });
    expect(await outbox()).toMatchObject([{ status: 'done' }]);
  });

  it('stops retrying a permanent rejection', async () => {
    submit.mockRejectedValue({ code: '23514', message: 'violates check constraint' });
    await mark('completed');
    await runSync();
    expect(await outbox()).toMatchObject([
      { status: 'failed', last_error: 'violates check constraint' },
    ]);
    expect(await only()).toMatchObject({ sync_status: 'failed' });
  });

  it('reschedules a transient failure with backoff instead of giving up', async () => {
    submit.mockRejectedValue(new Error('Network request failed'));
    await mark('completed');
    await runSync();
    const [item] = await outbox();
    expect(item).toMatchObject({ status: 'pending', attempt_count: 1 });
    expect(item.next_attempt_at > new Date().toISOString()).toBe(true);
    expect(await only()).toMatchObject({ sync_status: 'pending' });
  });

  it('never sends a correction ahead of a creation that is still waiting', async () => {
    submit.mockRejectedValueOnce(new Error('Network request failed'));
    await mark('missed');
    await runSync();
    await mark('completed');
    await runSync();
    expect(submit).toHaveBeenCalledTimes(1);

    await makeAllDue();
    await runSync();
    expect(submit.mock.calls.map(([e]) => e.eventType)).toEqual(['created', 'created', 'corrected']);
  });

  it('keeps an edit made mid-upload, even when the pull returns the older row', async () => {
    submit.mockImplementationOnce(async () => {
      await mark('completed');
      return APPLIED;
    });
    await mark('missed');
    const { delivery_id } = await only();
    (listDeliveriesForWorkerSince as jest.Mock).mockResolvedValue([
      {
        id: delivery_id,
        customer_id: 'c1',
        delivery_date: '2026-11-24',
        milk_type_id: 'milk',
        scheduled_quantity_ml: 1000,
        delivered_quantity_ml: 0,
        status: 'missed',
        reason: 'Not delivered',
        device_recorded_at: '2026-11-24T00:00:00Z',
        version: 1,
        has_conflict: false,
      },
    ]);
    await runSync();
    expect(await only()).toMatchObject({ status: 'completed', sync_status: 'pending' });
  });

  it('a call made mid-sync runs afterwards, so a delivery marked meanwhile is uploaded', async () => {
    let again: Promise<void> | undefined;
    submit.mockImplementationOnce(async () => {
      await mark('completed', 'c2');
      again = runSync();
      return APPLIED;
    });
    await mark('completed', 'c1');
    await runSync();
    await again;
    expect((await outbox()).map((i) => i.status)).toEqual(['done', 'done']);
  });

  it('a server row with a different id replaces the local one for that day', async () => {
    await mark('completed');
    (listDeliveriesForWorkerSince as jest.Mock).mockResolvedValue([
      {
        id: 'server-row',
        customer_id: 'c1',
        delivery_date: '2026-11-24',
        milk_type_id: 'milk',
        scheduled_quantity_ml: 1000,
        delivered_quantity_ml: 0,
        status: 'skipped',
        reason: 'Away',
        device_recorded_at: '2026-11-24T00:00:00Z',
        version: 1,
        has_conflict: true,
      },
    ]);
    submit.mockResolvedValue({ ...APPLIED, applied: false, conflict: true });
    await runSync();
    expect(await db.local_deliveries.toArray()).toMatchObject([
      { delivery_id: 'server-row', status: 'skipped', sync_status: 'conflict' },
    ]);
  });
});

it('clearAllLocalData empties every table', async () => {
  await mark('completed');
  await clearAllLocalData();
  for (const table of db.tables) expect(await table.count()).toBe(0);
});

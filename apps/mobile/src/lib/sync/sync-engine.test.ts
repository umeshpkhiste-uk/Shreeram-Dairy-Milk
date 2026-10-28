import NetInfo from '@react-native-community/netinfo';

import { listDeliveriesForWorkerSince, submitDeliveryEvent } from '@/lib/api/deliveries';
import { listCustomersForWorker } from '@/lib/api/customers';
import { listActiveMilkTypes } from '@/lib/api/milk-types';
import { updateLocalDeliverySyncStatus } from '@/lib/sqlite/deliveries-repo';
import {
  listDueOutboxItems,
  markOutboxConflict,
  markOutboxDone,
  markOutboxFailed,
  markOutboxInFlight,
  rescheduleOutboxItem,
} from '@/lib/sqlite/outbox-repo';
import { supabase } from '@/lib/supabase/client';

import { runSync } from './sync-engine';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));

jest.mock('@/lib/api/deliveries', () => ({
  submitDeliveryEvent: jest.fn(),
  listDeliveriesForWorkerSince: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/api/customers', () => ({
  listCustomersForWorker: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/api/milk-types', () => ({
  listActiveMilkTypes: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/sqlite/deliveries-repo', () => ({
  applyServerDelivery: jest.fn(),
  updateLocalDeliverySyncStatus: jest.fn(),
}));

jest.mock('@/lib/sqlite/outbox-repo', () => ({
  countFailedOutboxItems: jest.fn().mockReturnValue(0),
  countPendingOutboxItems: jest.fn().mockReturnValue(0),
  listDueOutboxItems: jest.fn().mockReturnValue([]),
  markOutboxConflict: jest.fn(),
  markOutboxDone: jest.fn(),
  markOutboxFailed: jest.fn(),
  markOutboxInFlight: jest.fn(),
  rescheduleOutboxItem: jest.fn(),
}));

jest.mock('@/lib/sqlite/cache-repo', () => ({
  replaceCachedCustomers: jest.fn(),
  replaceCachedMilkTypes: jest.fn(),
}));

const SESSION = { session: { user: { id: 'worker-1' } } };
const ONLINE_STATE = { isConnected: true, isInternetReachable: true };

const outboxItem = (overrides: Partial<Record<string, unknown>> = {}) => ({
  event_id: 'event-1',
  delivery_id: 'delivery-1',
  event_type: 'created' as const,
  payload: JSON.stringify({
    customerId: 'customer-1',
    milkTypeId: 'milk-1',
    deliveryDate: '2026-01-01',
    status: 'completed',
    deliveredQuantityMl: 1000,
    reason: null,
    expectedVersion: null,
    deviceRecordedAt: '2026-01-01T06:00:00.000Z',
  }),
  attempt_count: 0,
  next_attempt_at: '2026-01-01T06:00:00.000Z',
  last_error: null,
  status: 'pending' as const,
  created_at: '2026-01-01T06:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: SESSION });
  (NetInfo.fetch as jest.Mock).mockResolvedValue(ONLINE_STATE);
  (listDeliveriesForWorkerSince as jest.Mock).mockResolvedValue([]);
  (listCustomersForWorker as jest.Mock).mockResolvedValue([]);
  (listActiveMilkTypes as jest.Mock).mockResolvedValue([]);
});

describe('runSync', () => {
  it('does nothing when there is no signed-in session', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
    await runSync();
    expect(submitDeliveryEvent).not.toHaveBeenCalled();
  });

  it('does nothing when offline', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false, isInternetReachable: false });
    (listDueOutboxItems as jest.Mock).mockReturnValue([outboxItem()]);
    await runSync();
    expect(submitDeliveryEvent).not.toHaveBeenCalled();
  });

  it('marks a successfully applied item as synced', async () => {
    (listDueOutboxItems as jest.Mock).mockReturnValue([outboxItem()]);
    (submitDeliveryEvent as jest.Mock).mockResolvedValue({
      applied: true,
      duplicate: false,
      conflict: false,
      outcome: 'applied',
      delivery: null,
    });

    await runSync();

    expect(markOutboxInFlight).toHaveBeenCalledWith('event-1');
    expect(updateLocalDeliverySyncStatus).toHaveBeenCalledWith('delivery-1', 'synced', null);
    expect(markOutboxDone).toHaveBeenCalledWith('event-1');
    expect(rescheduleOutboxItem).not.toHaveBeenCalled();
    expect(markOutboxFailed).not.toHaveBeenCalled();
  });

  it('flags a server-reported conflict without retrying it', async () => {
    (listDueOutboxItems as jest.Mock).mockReturnValue([outboxItem()]);
    (submitDeliveryEvent as jest.Mock).mockResolvedValue({
      applied: false,
      duplicate: false,
      conflict: true,
      outcome: 'conflict_stale_version',
      delivery: null,
    });

    await runSync();

    expect(updateLocalDeliverySyncStatus).toHaveBeenCalledWith(
      'delivery-1',
      'conflict',
      expect.any(String),
    );
    expect(markOutboxConflict).toHaveBeenCalledWith('event-1');
    expect(rescheduleOutboxItem).not.toHaveBeenCalled();
  });

  it('a duplicate (already-synced retry) is treated as success, not reprocessed', async () => {
    (listDueOutboxItems as jest.Mock).mockReturnValue([outboxItem()]);
    (submitDeliveryEvent as jest.Mock).mockResolvedValue({
      applied: true,
      duplicate: true,
      conflict: false,
      outcome: 'applied',
      delivery: null,
    });

    await runSync();

    expect(updateLocalDeliverySyncStatus).toHaveBeenCalledWith('delivery-1', 'synced', null);
    expect(markOutboxDone).toHaveBeenCalledWith('event-1');
  });

  it('stops retrying a permanent rejection (e.g. an unauthorized customer)', async () => {
    (listDueOutboxItems as jest.Mock).mockReturnValue([outboxItem()]);
    (submitDeliveryEvent as jest.Mock).mockRejectedValue({
      code: '23514',
      message: 'violates check constraint',
    });

    await runSync();

    expect(markOutboxFailed).toHaveBeenCalledWith('event-1', expect.any(String));
    expect(updateLocalDeliverySyncStatus).toHaveBeenCalledWith(
      'delivery-1',
      'failed',
      expect.any(String),
    );
    expect(rescheduleOutboxItem).not.toHaveBeenCalled();
  });

  it('reschedules a transient failure with backoff instead of giving up', async () => {
    (listDueOutboxItems as jest.Mock).mockReturnValue([outboxItem({ attempt_count: 1 })]);
    (submitDeliveryEvent as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    await runSync();

    expect(rescheduleOutboxItem).toHaveBeenCalledWith(
      'event-1',
      expect.any(String),
      'Network request failed',
    );
    expect(markOutboxFailed).not.toHaveBeenCalled();
    expect(updateLocalDeliverySyncStatus).toHaveBeenCalledWith(
      'delivery-1',
      'pending',
      'Network request failed',
    );
  });
});

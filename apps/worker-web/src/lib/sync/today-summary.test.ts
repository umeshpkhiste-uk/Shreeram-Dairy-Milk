import { summarizeTodayDeliveries } from './today-summary';

const customers = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

describe('summarizeTodayDeliveries', () => {
  it('tallies statuses, quantities, and sync state', () => {
    const s = summarizeTodayDeliveries(customers, [
      {
        customer_id: 'a',
        milk_type_id: 'cow',
        delivered_quantity_ml: 1000,
        status: 'completed',
        sync_status: 'synced',
      },
      {
        customer_id: 'b',
        milk_type_id: 'buffalo',
        delivered_quantity_ml: 250,
        status: 'partial',
        sync_status: 'pending',
      },
      {
        customer_id: 'c',
        milk_type_id: 'cow',
        delivered_quantity_ml: 0,
        status: 'missed',
        sync_status: 'failed',
      },
    ]);
    expect(s).toMatchObject({
      totalCustomers: 4,
      delivered: 1,
      partial: 1,
      missed: 1,
      skipped: 0,
      notRecorded: 1,
      deliveredMlByMilkType: { cow: 1000, buffalo: 250 },
      synced: 1,
      waitingToSync: 2,
    });
  });

  it('ignores deliveries for customers no longer on the route', () => {
    const s = summarizeTodayDeliveries(customers.slice(0, 1), [
      {
        customer_id: 'z',
        milk_type_id: 'cow',
        delivered_quantity_ml: 1000,
        status: 'completed',
        sync_status: 'synced',
      },
    ]);
    expect(s.delivered).toBe(0);
    expect(s.deliveredMlByMilkType).toEqual({});
    expect(s.notRecorded).toBe(1);
  });

  it('handles an empty route', () => {
    const s = summarizeTodayDeliveries([], []);
    expect(s.totalCustomers).toBe(0);
    expect(s.notRecorded).toBe(0);
  });
});

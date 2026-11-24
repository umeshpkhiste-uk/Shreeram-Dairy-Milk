import { formatMlAsLitres, summarizeTodayDeliveries } from './today-summary';

const customers = [
  { id: 'a', default_daily_quantity_ml: 1000, milk_type_id: 'cow' },
  { id: 'b', default_daily_quantity_ml: 500, milk_type_id: 'buffalo' },
  { id: 'c', default_daily_quantity_ml: 1500, milk_type_id: 'cow' },
  { id: 'd', default_daily_quantity_ml: 1000, milk_type_id: 'cow' },
];

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
      scheduledMl: 4000,
      deliveredMl: 1250,
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
    expect(s.deliveredMl).toBe(0);
    expect(s.notRecorded).toBe(1);
  });

  it('handles an empty route', () => {
    const s = summarizeTodayDeliveries([], []);
    expect(s.totalCustomers).toBe(0);
    expect(s.notRecorded).toBe(0);
  });
});

describe('formatMlAsLitres', () => {
  it.each([
    [1000, '1 L'],
    [12500, '12.5 L'],
    [250, '0.25 L'],
    [0, '0 L'],
  ])('%d ml → %s', (ml, expected) => {
    expect(formatMlAsLitres(ml)).toBe(expected);
  });
});

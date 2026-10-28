import {
  computeDashboardMetrics,
  mergeDeliveryReport,
  type CustomerRow,
  type DeliveryRow,
  type WorkerSummary,
} from './metrics';

function customer(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: 'customer-1',
    full_name: 'Test Customer',
    mobile_number: '+919000000000',
    email: null,
    address: '1 Test St',
    locality: null,
    landmark: null,
    assigned_worker_id: 'worker-1',
    route_id: null,
    route_sequence: null,
    status: 'active',
    default_daily_quantity_ml: 500,
    milk_type_id: 'milk-1',
    preferred_delivery_window: null,
    delivery_start_date: '2026-01-01',
    notes: null,
    billing_contact_name: null,
    billing_contact_phone: null,
    account_reference: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_by: null,
    ...overrides,
  };
}

function delivery(overrides: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: 'delivery-1',
    customer_id: 'customer-1',
    worker_id: 'worker-1',
    milk_type_id: 'milk-1',
    delivery_date: '2026-01-15',
    scheduled_quantity_ml: 500,
    delivered_quantity_ml: 500,
    status: 'completed',
    reason: null,
    price_paise_snapshot: 5500,
    device_recorded_at: '2026-01-15T06:00:00.000Z',
    server_created_at: '2026-01-15T06:00:01.000Z',
    version: 1,
    has_conflict: false,
    created_by: 'worker-1',
    updated_at: '2026-01-15T06:00:01.000Z',
    ...overrides,
  };
}

function worker(overrides: Partial<WorkerSummary> = {}): WorkerSummary {
  return {
    id: 'worker-1',
    fullName: 'Test Worker',
    phone: null,
    isActive: true,
    route: null,
    ...overrides,
  };
}

describe('computeDashboardMetrics', () => {
  const today = '2026-01-15';

  it('counts active customers and workers regardless of schedule', () => {
    const metrics = computeDashboardMetrics(
      [customer({ id: 'c1' }), customer({ id: 'c2' })],
      [worker({ id: 'w1' }), worker({ id: 'w2', isActive: false })],
      [],
      today,
    );
    expect(metrics.activeCustomers).toBe(2);
    expect(metrics.activeWorkers).toBe(1);
  });

  it('excludes a customer whose delivery_start_date is in the future from "scheduled today"', () => {
    const metrics = computeDashboardMetrics(
      [
        customer({ id: 'c1', delivery_start_date: '2026-01-01' }),
        customer({ id: 'c2', delivery_start_date: '2026-02-01' }),
      ],
      [],
      [],
      today,
    );
    expect(metrics.scheduledToday).toBe(1);
  });

  it("splits today's deliveries into completed/partial/missed and leaves the rest as no_record", () => {
    const customers = [
      customer({ id: 'c1' }),
      customer({ id: 'c2' }),
      customer({ id: 'c3' }),
      customer({ id: 'c4' }),
    ];
    const deliveries = [
      delivery({ customer_id: 'c1', status: 'completed' }),
      delivery({ customer_id: 'c2', status: 'partial' }),
      delivery({ customer_id: 'c3', status: 'missed' }),
      // c4 has no delivery row at all.
    ];
    const metrics = computeDashboardMetrics(customers, [], deliveries, today);
    expect(metrics.completedToday).toBe(1);
    expect(metrics.partialToday).toBe(1);
    expect(metrics.missedToday).toBe(1);
    expect(metrics.noRecordToday).toBe(1);
  });

  it('sums delivered millilitres and estimated sales as exact integer paise', () => {
    const deliveries = [
      delivery({ customer_id: 'c1', delivered_quantity_ml: 500, price_paise_snapshot: 5500 }),
      delivery({ customer_id: 'c2', delivered_quantity_ml: 1000, price_paise_snapshot: 6500 }),
    ];
    const metrics = computeDashboardMetrics(
      [customer({ id: 'c1' }), customer({ id: 'c2' })],
      [],
      deliveries,
      today,
    );
    expect(metrics.totalMlDeliveredToday).toBe(1500);
    // 5500 * 500 / 1000 = 2750, 6500 * 1000 / 1000 = 6500 -> 9250 paise
    expect(metrics.estimatedSalesPaiseToday).toBe(9250);
  });
});

describe('mergeDeliveryReport', () => {
  it('includes a customer with no delivery row as no_record, never as missed', () => {
    const rows = mergeDeliveryReport([customer({ id: 'c1' })], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].delivery).toBeNull();
  });

  it('pairs a customer with their matching delivery', () => {
    const rows = mergeDeliveryReport(
      [customer({ id: 'c1' })],
      [delivery({ customer_id: 'c1', status: 'partial' })],
    );
    expect(rows[0].delivery?.status).toBe('partial');
  });

  it('filters to no_record only', () => {
    const rows = mergeDeliveryReport(
      [customer({ id: 'c1' }), customer({ id: 'c2' })],
      [delivery({ customer_id: 'c1', status: 'completed' })],
      'no_record',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].customer.id).toBe('c2');
  });

  it('filters to a specific delivery status', () => {
    const rows = mergeDeliveryReport(
      [customer({ id: 'c1' }), customer({ id: 'c2' })],
      [
        delivery({ customer_id: 'c1', status: 'missed' }),
        delivery({ customer_id: 'c2', status: 'completed' }),
      ],
      'missed',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].customer.id).toBe('c1');
  });
});

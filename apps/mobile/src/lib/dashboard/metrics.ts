import type { CustomerRow } from '@/lib/api/customers';
import type { DeliveryRow } from '@/lib/api/deliveries';
import type { WorkerSummary } from '@/lib/api/workers';
import type { DeliveryStatus } from '@/types/database';

/**
 * Pure aggregation — no Supabase calls — so it's unit-testable and reusable
 * by both the dashboard and (for the report's filter-count context) the
 * daily delivery report screen.
 */

export type DashboardMetrics = {
  activeCustomers: number;
  activeWorkers: number;
  scheduledToday: number;
  completedToday: number;
  partialToday: number;
  missedToday: number;
  /** No `deliveries` row reached the server for this customer yet. Not proof
   * of a missed delivery — it may be genuinely pending, or completed offline
   * and not yet synced. See docs/admin-monitoring.md. */
  noRecordToday: number;
  totalMlDeliveredToday: number;
  /** Per-delivery price × quantity, rounded to the nearest paise before
   * summing (no compounding drift). An estimate — authoritative billing
   * math arrives in Stage 5. */
  estimatedSalesPaiseToday: number;
};

export function computeDashboardMetrics(
  activeCustomers: CustomerRow[],
  workers: WorkerSummary[],
  deliveriesToday: DeliveryRow[],
  today: string,
): DashboardMetrics {
  const scheduled = activeCustomers.filter((c) => c.delivery_start_date <= today);
  const recordedCustomerIds = new Set(deliveriesToday.map((d) => d.customer_id));
  const noRecordToday = scheduled.filter((c) => !recordedCustomerIds.has(c.id)).length;

  let completedToday = 0;
  let partialToday = 0;
  let missedToday = 0;
  let totalMlDeliveredToday = 0;
  let estimatedSalesPaiseToday = 0;

  for (const delivery of deliveriesToday) {
    if (delivery.status === 'completed') completedToday += 1;
    else if (delivery.status === 'partial') partialToday += 1;
    else if (delivery.status === 'missed') missedToday += 1;

    totalMlDeliveredToday += delivery.delivered_quantity_ml;
    estimatedSalesPaiseToday += Math.round(
      (delivery.price_paise_snapshot * delivery.delivered_quantity_ml) / 1000,
    );
  }

  return {
    activeCustomers: activeCustomers.length,
    activeWorkers: workers.filter((w) => w.isActive).length,
    scheduledToday: scheduled.length,
    completedToday,
    partialToday,
    missedToday,
    noRecordToday,
    totalMlDeliveredToday,
    estimatedSalesPaiseToday,
  };
}

export type DeliveryReportStatusFilter = DeliveryStatus | 'no_record' | null;

export type DeliveryReportRow = {
  customer: CustomerRow;
  delivery: DeliveryRow | null;
};

/**
 * Left-joins the scheduled-customer list with that date's deliveries, so a
 * customer with no delivery row still appears — labeled `no_record`, never
 * silently dropped or presented as `missed`.
 */
export function mergeDeliveryReport(
  customers: CustomerRow[],
  deliveries: DeliveryRow[],
  statusFilter: DeliveryReportStatusFilter = null,
): DeliveryReportRow[] {
  const deliveryByCustomerId = new Map(deliveries.map((d) => [d.customer_id, d]));
  const rows = customers.map((customer) => ({
    customer,
    delivery: deliveryByCustomerId.get(customer.id) ?? null,
  }));

  if (!statusFilter) return rows;
  return rows.filter((row) =>
    statusFilter === 'no_record' ? row.delivery === null : row.delivery?.status === statusFilter,
  );
}

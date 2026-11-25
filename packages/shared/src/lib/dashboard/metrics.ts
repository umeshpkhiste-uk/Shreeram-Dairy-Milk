import type { Database, DeliveryStatus } from '../../types/database';
import { dayProducts } from '../products';

/**
 * Pure aggregation — no Supabase calls — shared by the
 * dashboard and the delivery report.
 */

export type CustomerRow = Database['public']['Tables']['customers']['Row'];
export type DeliveryRow = Database['public']['Tables']['deliveries']['Row'];
export type WorkerSummary = {
  id: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  route: { id: string; name: string } | null;
};

export type DashboardMetrics = {
  activeCustomers: number;
  activeWorkers: number;
  /** Product deliveries, not customers: one customer can take several products. */
  scheduledToday: number;
  completedToday: number;
  partialToday: number;
  missedToday: number;
  /** No `deliveries` row reached the server for this customer's product yet. Not proof
   * of a missed delivery — it may be genuinely pending, or completed offline
   * and not yet synced. See docs/admin-monitoring.md. */
  noRecordToday: number;
  /** Per-delivery price × quantity, rounded to the nearest paise before
   * summing (no compounding drift). An estimate, not authoritative billing. */
  estimatedSalesPaiseToday: number;
};

export function computeDashboardMetrics(
  activeCustomers: CustomerRow[],
  workers: WorkerSummary[],
  deliveriesToday: DeliveryRow[],
  today: string,
): DashboardMetrics {
  const scheduled = activeCustomers.filter((c) => c.delivery_start_date <= today);
  const scheduledProducts = mergeDeliveryReport(scheduled, deliveriesToday);

  let completedToday = 0;
  let partialToday = 0;
  let missedToday = 0;
  let estimatedSalesPaiseToday = 0;

  for (const delivery of deliveriesToday) {
    if (delivery.status === 'completed') completedToday += 1;
    else if (delivery.status === 'partial') partialToday += 1;
    else if (delivery.status === 'missed') missedToday += 1;

    estimatedSalesPaiseToday += Math.round(
      (delivery.price_paise_snapshot * delivery.delivered_quantity_ml) / 1000,
    );
  }

  return {
    activeCustomers: activeCustomers.length,
    activeWorkers: workers.filter((w) => w.isActive).length,
    scheduledToday: scheduledProducts.length,
    completedToday,
    partialToday,
    missedToday,
    noRecordToday: scheduledProducts.filter((row) => row.delivery === null).length,
    estimatedSalesPaiseToday,
  };
}

export type DeliveryReportStatusFilter = DeliveryStatus | 'no_record' | null;

export type DeliveryReportRow = {
  customer: CustomerRow;
  milkTypeId: string;
  /** Scheduled ml or grams. */
  quantity: number;
  delivery: DeliveryRow | null;
};

/**
 * One row per customer and product, left-joined with that date's deliveries, so a
 * product with no delivery row still appears — labeled `no_record`, never
 * silently dropped or presented as `missed`.
 */
export function mergeDeliveryReport(
  customers: CustomerRow[],
  deliveries: DeliveryRow[],
  statusFilter: DeliveryReportStatusFilter = null,
): DeliveryReportRow[] {
  const rows = customers.flatMap((customer) =>
    dayProducts(
      customer,
      deliveries.filter((d) => d.customer_id === customer.id),
    ).map((product) => ({ customer, ...product })),
  );

  if (!statusFilter) return rows;
  return rows.filter((row) =>
    statusFilter === 'no_record' ? row.delivery === null : row.delivery?.status === statusFilter,
  );
}

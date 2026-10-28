import type { Database, DeliveryStatus } from '../../types/database';

/**
 * Pure aggregation — no Supabase calls — shared by the mobile dashboard and
 * the website dashboard/delivery report so both compute the exact same
 * numbers from the exact same rows. Copied from apps/mobile/src/lib/dashboard/metrics.ts
 * (Stage 4) into this shared package in Stage 7 — behavior is unchanged,
 * only the `CustomerRow`/`DeliveryRow`/`WorkerSummary` types now come
 * directly from the shared `Database` type instead of each app's own API
 * layer.
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

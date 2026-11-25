import type { DeliveryStatus } from '@shreeram/shared';

type SummaryCustomer = { id: string };
type SummaryDelivery = {
  customer_id: string;
  milk_type_id: string;
  delivered_quantity_ml: number;
  status: DeliveryStatus;
  sync_status: string;
};

export type TodayDeliverySummary = {
  totalCustomers: number;
  delivered: number;
  partial: number;
  missed: number;
  skipped: number;
  notRecorded: number;
  /** Delivered ml (or grams) per product type id, only types with deliveries today. */
  deliveredMlByMilkType: Record<string, number>;
  synced: number;
  waitingToSync: number;
};

/**
 * Pure tally of the worker's day for the Sync Status screen, so they can
 * check the numbers before syncing. Only deliveries for customers on the
 * worker's current route count toward the route totals.
 */
export function summarizeTodayDeliveries(
  customers: SummaryCustomer[],
  deliveries: SummaryDelivery[],
): TodayDeliverySummary {
  const customerIds = new Set(customers.map((c) => c.id));
  const todays = deliveries.filter((d) => customerIds.has(d.customer_id));

  const summary: TodayDeliverySummary = {
    totalCustomers: customers.length,
    delivered: 0,
    partial: 0,
    missed: 0,
    skipped: 0,
    notRecorded: customers.length - new Set(todays.map((d) => d.customer_id)).size,
    deliveredMlByMilkType: {},
    synced: 0,
    waitingToSync: 0,
  };

  for (const d of todays) {
    if (d.status === 'completed') summary.delivered += 1;
    else if (d.status === 'partial') summary.partial += 1;
    else if (d.status === 'missed') summary.missed += 1;
    else if (d.status === 'skipped') summary.skipped += 1;

    if (d.delivered_quantity_ml > 0) {
      summary.deliveredMlByMilkType[d.milk_type_id] =
        (summary.deliveredMlByMilkType[d.milk_type_id] ?? 0) + d.delivered_quantity_ml;
    }

    if (d.sync_status === 'synced') summary.synced += 1;
    else summary.waitingToSync += 1;
  }

  return summary;
}

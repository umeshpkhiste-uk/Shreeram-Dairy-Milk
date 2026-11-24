import type { LocalDelivery } from '@/lib/db/db';

export const HISTORY_DAYS = 14;

export function summarizeHistory(
  deliveries: Pick<LocalDelivery, 'status' | 'delivered_quantity_ml'>[],
) {
  const delivered = deliveries.filter((d) => d.status === 'completed' || d.status === 'partial');
  return {
    delivered: delivered.length,
    missed: deliveries.filter((d) => d.status === 'missed').length,
    skipped: deliveries.filter((d) => d.status === 'skipped').length,
    totalMl: delivered.reduce((sum, d) => sum + d.delivered_quantity_ml, 0),
  };
}

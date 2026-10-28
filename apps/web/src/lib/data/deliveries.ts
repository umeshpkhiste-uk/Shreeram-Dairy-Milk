import {
  mergeDeliveryReport,
  type DeliveryReportRow,
  type DeliveryReportStatusFilter,
} from '@shreeram/shared';
import type { Database } from '@shreeram/shared';

import { listCustomers } from './customers';
import type { SupabaseServerClient } from './types';

export type DeliveryRow = Database['public']['Tables']['deliveries']['Row'];

/** All deliveries for a single date. RLS already scopes this to what the signed-in admin can see. */
export async function listDeliveriesForDate(
  supabase: SupabaseServerClient,
  date: string,
): Promise<DeliveryRow[]> {
  const { data, error } = await supabase.from('deliveries').select('*').eq('delivery_date', date);
  if (error) throw error;
  return data ?? [];
}

export type DeliveryReportFilters = {
  date: string; // YYYY-MM-DD
  workerId?: string;
  routeId?: string;
  customerSearch?: string;
  status?: DeliveryReportStatusFilter;
};

/**
 * The admin daily delivery report — identical logic to the mobile app's
 * `listDailyDeliveryReport` (apps/mobile/src/lib/api/deliveries.ts), reusing
 * the same shared `mergeDeliveryReport` so both apps show exactly the same
 * rows for the same date/filters.
 */
export async function listDailyDeliveryReport(
  supabase: SupabaseServerClient,
  filters: DeliveryReportFilters,
): Promise<DeliveryReportRow[]> {
  const [customers, deliveries] = await Promise.all([
    listCustomers(supabase, {
      status: 'active',
      workerId: filters.workerId,
      routeId: filters.routeId,
      search: filters.customerSearch,
    }),
    listDeliveriesForDate(supabase, filters.date),
  ]);

  return mergeDeliveryReport(customers, deliveries, filters.status ?? null);
}

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

/**
 * One customer's deliveries within an inclusive date range — the source for
 * the per-customer delivery calendar (/deliveries/[customerId]). RLS already
 * scopes this to what the signed-in admin can see.
 */
export async function listDeliveriesForCustomerInRange(
  supabase: SupabaseServerClient,
  customerId: string,
  startDate: string,
  endDate: string,
): Promise<DeliveryRow[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('customer_id', customerId)
    .gte('delivery_date', startDate)
    .lte('delivery_date', endDate);
  if (error) throw error;
  return data ?? [];
}

/**
 * Admin-only: marks a customer's day as 'skipped' (customer informed the
 * business in advance not to deliver) — see
 * supabase/migrations/20261028130001_stage7_admin_mark_skipped_rpc.sql.
 * Excluded from billing exactly like 'missed'; cannot overwrite a day that
 * already has a completed/partial delivery recorded.
 */
export async function markDeliverySkipped(
  supabase: SupabaseServerClient,
  customerId: string,
  deliveryDate: string,
  reason: string,
): Promise<DeliveryRow> {
  const { data, error } = await supabase.rpc('admin_mark_delivery_skipped', {
    p_customer_id: customerId,
    p_delivery_date: deliveryDate,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
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

import { listCustomers } from '@/lib/api/customers';
import {
  mergeDeliveryReport,
  type DeliveryReportRow,
  type DeliveryReportStatusFilter,
} from '@/lib/dashboard/metrics';
import { supabase } from '@/lib/supabase/client';
import type { Database, DeliveryStatus } from '@/types/database';

export type DeliveryRow = Database['public']['Tables']['deliveries']['Row'];

export type SubmitDeliveryEventInput = {
  eventId: string;
  deliveryId: string;
  customerId: string;
  milkTypeId: string;
  deliveryDate: string; // YYYY-MM-DD
  eventType: 'created' | 'corrected';
  status: DeliveryStatus;
  deliveredQuantityMl: number;
  reason: string | null;
  expectedVersion: number | null;
  deviceRecordedAt: string; // ISO timestamp
};

export type SubmitDeliveryEventResult = {
  applied: boolean;
  duplicate: boolean;
  conflict: boolean;
  outcome: string;
  delivery: DeliveryRow | null;
};

/**
 * The only write path for deliveries — see
 * supabase/migrations/20261028090002_stage3_submit_delivery_event_rpc.sql.
 * Idempotent on `eventId`: a retried call with the same id is answered from
 * the stored receipt, never reprocessed.
 */
export async function submitDeliveryEvent(
  input: SubmitDeliveryEventInput,
): Promise<SubmitDeliveryEventResult> {
  const { data, error } = await supabase.rpc('submit_delivery_event', {
    p_event_id: input.eventId,
    p_delivery_id: input.deliveryId,
    p_customer_id: input.customerId,
    p_milk_type_id: input.milkTypeId,
    p_delivery_date: input.deliveryDate,
    p_event_type: input.eventType,
    p_status: input.status,
    p_delivered_quantity_ml: input.deliveredQuantityMl,
    p_reason: input.reason,
    p_expected_version: input.expectedVersion,
    p_device_recorded_at: input.deviceRecordedAt,
  });
  if (error) throw error;
  return data as unknown as SubmitDeliveryEventResult;
}

/** Pulls the worker's own deliveries since a given date, for local reconciliation. */
export async function listDeliveriesForWorkerSince(
  workerId: string,
  sinceDate: string,
): Promise<DeliveryRow[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('worker_id', workerId)
    .gte('delivery_date', sinceDate)
    .order('delivery_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * All deliveries for a single date. RLS scopes this automatically — an
 * admin sees every worker's rows, a worker only their own — so this same
 * function serves both the admin dashboard/report and could be reused
 * worker-side without any extra filtering here.
 */
export async function listDeliveriesForDate(date: string): Promise<DeliveryRow[]> {
  const { data, error } = await supabase.from('deliveries').select('*').eq('delivery_date', date);
  if (error) throw error;
  return data ?? [];
}

/**
 * One customer's deliveries within an inclusive date range — used by the
 * worker's per-customer calendar. RLS scopes this to the worker's own
 * records automatically (deliveries_select_admin_or_own_worker).
 */
export async function listDeliveriesForCustomerInRange(
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

export type DeliveryReportFilters = {
  date: string; // YYYY-MM-DD
  workerId?: string;
  routeId?: string;
  customerSearch?: string;
  status?: DeliveryReportStatusFilter;
};

/**
 * The admin daily delivery report: every currently-active, in-scope
 * customer for the given date, left-joined with that date's delivery (if
 * any reached the server) — see mergeDeliveryReport for why a missing row
 * is never treated as a missed delivery.
 */
export async function listDailyDeliveryReport(
  filters: DeliveryReportFilters,
): Promise<DeliveryReportRow[]> {
  const [customers, deliveries] = await Promise.all([
    listCustomers({
      status: 'active',
      workerId: filters.workerId,
      routeId: filters.routeId,
      search: filters.customerSearch,
    }),
    listDeliveriesForDate(filters.date),
  ]);

  return mergeDeliveryReport(customers, deliveries, filters.status ?? null);
}

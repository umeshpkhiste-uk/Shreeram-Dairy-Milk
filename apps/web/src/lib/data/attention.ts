import { formatBillingMonth, formatPaiseAsRupees } from '@shreeram/shared';

import { listDailyDeliveryReport } from './deliveries';
import { listAllMilkTypes } from './milk-types';
import type { SupabaseServerClient } from './types';

export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  label: string;
  tone: 'neutral' | 'warning' | 'danger';
};

async function customerNames(supabase: SupabaseServerClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name')
    .in('id', [...new Set(ids)]);
  if (error) throw error;
  return new Map((data ?? []).map((c) => [c.id, c.full_name]));
}

/** Inbox: monthly bills created but not finalized yet, any month. */
export async function listInboxItems(supabase: SupabaseServerClient): Promise<AttentionItem[]> {
  const { data: bills, error } = await supabase
    .from('monthly_bills')
    .select('*')
    .eq('status', 'draft')
    .order('billing_month', { ascending: false });
  if (error) throw error;

  const names = await customerNames(supabase, bills.map((b) => b.customer_id));
  return bills.map((bill) => ({
    id: bill.id,
    title: names.get(bill.customer_id) ?? 'Customer',
    detail: `${bill.bill_number} · ${formatBillingMonth(bill.billing_month)} · ${formatPaiseAsRupees(bill.total_payable_paise)}`,
    href: `/billing/${bill.id}`,
    label: 'Draft',
    tone: 'neutral',
  }));
}

/** Notifications: delivery conflicts, flagged bills, and today's missed or unrecorded deliveries. */
export async function listNotificationItems(
  supabase: SupabaseServerClient,
  today: string,
): Promise<AttentionItem[]> {
  const [conflicts, flagged, report, milkTypes] = await Promise.all([
    supabase
      .from('deliveries')
      .select('*')
      .eq('has_conflict', true)
      .order('delivery_date', { ascending: false }),
    supabase.from('monthly_bills').select('*').eq('flagged_for_review', true).neq('status', 'voided'),
    listDailyDeliveryReport(supabase, { date: today }),
    listAllMilkTypes(supabase),
  ]);
  if (conflicts.error) throw conflicts.error;
  if (flagged.error) throw flagged.error;

  const names = await customerNames(supabase, [
    ...conflicts.data.map((d) => d.customer_id),
    ...flagged.data.map((b) => b.customer_id),
  ]);

  const productNames = new Map(milkTypes.map((m) => [m.id, m.name]));
  const productName = (id: string) => productNames.get(id) ?? 'Product';

  const calendarHref = (customerId: string, date: string) =>
    `/deliveries/${customerId}?month=${date.slice(0, 7)}-01&day=${date}`;

  return [
    ...conflicts.data.map(
      (d): AttentionItem => ({
        id: `conflict-${d.id}`,
        title: names.get(d.customer_id) ?? 'Customer',
        detail: `${productName(d.milk_type_id)}: two different records for ${d.delivery_date}. Check which one is right.`,
        href: calendarHref(d.customer_id, d.delivery_date),
        label: 'Conflict',
        tone: 'danger',
      }),
    ),
    ...flagged.data.map(
      (bill): AttentionItem => ({
        id: `flagged-${bill.id}`,
        title: names.get(bill.customer_id) ?? 'Customer',
        detail: `${bill.bill_number}: ${bill.flagged_reason ?? 'flagged for review'}`,
        href: `/billing/${bill.id}`,
        label: 'Bill flagged',
        tone: 'warning',
      }),
    ),
    ...report
      .filter((row) => row.delivery === null || row.delivery.status === 'missed')
      .map(
        ({ customer, milkTypeId, delivery }): AttentionItem => ({
          id: `today-${customer.id}-${milkTypeId}`,
          title: customer.full_name,
          detail: `${productName(milkTypeId)}: ${
            delivery
              ? (delivery.reason ?? 'Marked not delivered today')
              : 'No delivery recorded yet today'
          }`,
          href: calendarHref(customer.id, today),
          label: delivery ? 'Missed' : 'No record',
          tone: delivery ? 'danger' : 'neutral',
        }),
      ),
  ];
}

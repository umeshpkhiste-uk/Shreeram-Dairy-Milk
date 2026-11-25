import { firstOfMonth, formatBillingMonth, formatPaiseAsRupees, shiftMonth } from '@shreeram/shared';

import { listUnbilledMonths } from './bills';
import { listDailyDeliveryReport } from './deliveries';
import { listAllMilkTypes } from './milk-types';
import { listPendingPaymentClaims } from './payments';
import { listSyncFailures } from './sync';
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

/** Inbox: payments customers say they made, and bills not generated yet, any month. */
export async function listInboxItems(supabase: SupabaseServerClient): Promise<AttentionItem[]> {
  const claims = await listPendingPaymentClaims(supabase);
  const { data: bills, error } = await supabase
    .from('monthly_bills')
    .select('*')
    .or(`status.eq.draft,id.in.(${claims.map((c) => c.bill_id).join(',')})`)
    .order('billing_month', { ascending: false });
  if (error) throw error;

  const names = await customerNames(supabase, bills.map((b) => b.customer_id));
  const billById = new Map(bills.map((b) => [b.id, b]));
  return [
    ...claims.flatMap((claim): AttentionItem[] => {
      const bill = billById.get(claim.bill_id);
      if (!bill) return [];
      return [
        {
          id: claim.id,
          title: names.get(bill.customer_id) ?? 'Customer',
          detail: `${bill.bill_number}: says ${formatPaiseAsRupees(claim.amount_paise)} was paid by UPI, transaction ${claim.transaction_reference}. Check your bank.`,
          href: `/billing/${bill.id}`,
          label: 'Payment to check',
          tone: 'warning',
        },
      ];
    }),
    ...bills
      .filter((bill) => bill.status === 'draft')
      .map(
        (bill): AttentionItem => ({
          id: bill.id,
          title: names.get(bill.customer_id) ?? 'Customer',
          detail: `${bill.bill_number} · ${formatBillingMonth(bill.billing_month)} · ${formatPaiseAsRupees(bill.total_payable_paise)}`,
          href: `/billing/${bill.id}`,
          label: 'Draft',
          tone: 'neutral',
        }),
      ),
  ];
}

/** Notifications: delivery conflicts, flagged bills, months not billed, records
 * workers' phones could not save, and today's missed or unrecorded deliveries. */
export async function listNotificationItems(
  supabase: SupabaseServerClient,
  today: string,
): Promise<AttentionItem[]> {
  const [conflicts, flagged, report, milkTypes, unbilled, failures] = await Promise.all([
    supabase
      .from('deliveries')
      .select('*')
      .eq('has_conflict', true)
      .order('delivery_date', { ascending: false }),
    supabase.from('monthly_bills').select('*').eq('flagged_for_review', true).neq('status', 'voided'),
    listDailyDeliveryReport(supabase, { date: today }),
    listAllMilkTypes(supabase),
    // shortcut: the last two finished months, because this runs on every page; the bill page checks all.
    listUnbilledMonths(supabase, shiftMonth(firstOfMonth(today), -2)),
    listSyncFailures(supabase),
  ]);
  if (conflicts.error) throw conflicts.error;
  if (flagged.error) throw flagged.error;

  const names = await customerNames(supabase, [
    ...conflicts.data.map((d) => d.customer_id),
    ...flagged.data.map((b) => b.customer_id),
    ...unbilled.map((u) => u.customer_id),
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
    ...failures.map(
      (f): AttentionItem => ({
        id: `sync-${f.event_id}`,
        title: 'A worker’s record was not saved',
        detail: f.error,
        href: '/deliveries/sync',
        label: 'Sync',
        tone: 'danger',
      }),
    ),
    ...unbilled.map(
      (u): AttentionItem => ({
        id: `unbilled-${u.customer_id}-${u.billing_month}`,
        title: names.get(u.customer_id) ?? 'Customer',
        detail: `No bill for ${formatBillingMonth(u.billing_month)}: ${formatPaiseAsRupees(u.amount_paise)} is not billed.`,
        href: `/billing?month=${u.billing_month}`,
        label: 'Not billed',
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

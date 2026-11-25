import type { BillPdfData, Database } from '@shreeram/shared';

import type { SupabaseServerClient } from './types';

export type MonthlyBillRow = Database['public']['Tables']['monthly_bills']['Row'];
export type BillAdjustmentRow = Database['public']['Tables']['bill_adjustments']['Row'];
export type PaymentRow = Database['public']['Tables']['payments']['Row'];

export type BillWithDetails = {
  bill: MonthlyBillRow;
  adjustments: BillAdjustmentRow[];
  payments: PaymentRow[];
};

export async function listBillsForCustomer(
  supabase: SupabaseServerClient,
  customerId: string,
): Promise<MonthlyBillRow[]> {
  const { data, error } = await supabase
    .from('monthly_bills')
    .select('*')
    .eq('customer_id', customerId)
    .order('billing_month', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** All non-voided bills for a billing month, across customers — the Billing list page's source. */
export async function listBillsForMonth(
  supabase: SupabaseServerClient,
  billingMonth: string,
): Promise<MonthlyBillRow[]> {
  const { data, error } = await supabase
    .from('monthly_bills')
    .select('*')
    .eq('billing_month', billingMonth)
    .neq('status', 'voided');
  if (error) throw error;
  return data ?? [];
}

export async function getBillWithDetails(
  supabase: SupabaseServerClient,
  billId: string,
): Promise<BillWithDetails | null> {
  const [billRes, adjustmentsRes, paymentsRes] = await Promise.all([
    supabase.from('monthly_bills').select('*').eq('id', billId).maybeSingle(),
    supabase.from('bill_adjustments').select('*').eq('bill_id', billId).order('created_at'),
    supabase.from('payments').select('*').eq('bill_id', billId).order('payment_date'),
  ]);
  if (billRes.error) throw billRes.error;
  if (adjustmentsRes.error) throw adjustmentsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (!billRes.data) return null;
  return {
    bill: billRes.data,
    adjustments: adjustmentsRes.data ?? [],
    payments: paymentsRes.data ?? [],
  };
}

export async function createDraftBill(
  supabase: SupabaseServerClient,
  customerId: string,
  billingMonth: string,
): Promise<MonthlyBillRow> {
  const { data, error } = await supabase.rpc('create_draft_bill', {
    p_customer_id: customerId,
    p_billing_month: billingMonth,
  });
  if (error) throw error;
  return data;
}

export async function addBillAdjustment(
  supabase: SupabaseServerClient,
  billId: string,
  amountPaise: number,
  reason: string,
): Promise<MonthlyBillRow> {
  const { data, error } = await supabase.rpc('add_bill_adjustment', {
    p_bill_id: billId,
    p_amount_paise: amountPaise,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

/** Brings the bill up to today and, if it was a draft, finalizes it. Can be run again. */
export async function generateBill(
  supabase: SupabaseServerClient,
  billId: string,
): Promise<MonthlyBillRow> {
  const { data, error } = await supabase.rpc('generate_bill', { p_bill_id: billId });
  if (error) throw error;
  return data;
}

/** The whole bill, also for a customer who isn't signed in; null when there is none to see. */
export async function getBillDocument(
  supabase: SupabaseServerClient,
  billId: string,
): Promise<BillPdfData | null> {
  const { data, error } = await supabase.rpc('get_bill_document', { p_bill_id: billId });
  if (error) throw error;
  return data as BillPdfData | null;
}

/** Removes a draft bill outright; a generated bill stays. */
export async function cancelDraftBill(
  supabase: SupabaseServerClient,
  billId: string,
): Promise<void> {
  const { error } = await supabase.rpc('cancel_draft_bill', { p_bill_id: billId });
  if (error) throw error;
}

/** Finished months from `from` on with something to charge and no bill. */
export async function listUnbilledMonths(
  supabase: SupabaseServerClient,
  from: string,
  customerId?: string,
): Promise<{ customer_id: string; billing_month: string; amount_paise: number }[]> {
  const { data, error } = await supabase.rpc('list_unbilled_months', {
    p_from: from,
    p_customer_id: customerId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function acknowledgeBillFlag(
  supabase: SupabaseServerClient,
  billId: string,
): Promise<MonthlyBillRow> {
  const { data, error } = await supabase.rpc('acknowledge_bill_flag', { p_bill_id: billId });
  if (error) throw error;
  return data;
}

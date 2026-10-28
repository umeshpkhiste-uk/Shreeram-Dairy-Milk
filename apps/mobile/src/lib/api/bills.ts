import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

export type MonthlyBillRow = Database['public']['Tables']['monthly_bills']['Row'];
export type BillItemRow = Database['public']['Tables']['bill_items']['Row'];
export type BillAdjustmentRow = Database['public']['Tables']['bill_adjustments']['Row'];
export type PaymentRow = Database['public']['Tables']['payments']['Row'];

export type BillWithDetails = {
  bill: MonthlyBillRow;
  items: BillItemRow[];
  adjustments: BillAdjustmentRow[];
  payments: PaymentRow[];
};

export async function listBillsForCustomer(customerId: string): Promise<MonthlyBillRow[]> {
  const { data, error } = await supabase
    .from('monthly_bills')
    .select('*')
    .eq('customer_id', customerId)
    .order('billing_month', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** All non-voided bills for a billing month, across customers — the billing-list screen's source. */
export async function listBillsForMonth(billingMonth: string): Promise<MonthlyBillRow[]> {
  const { data, error } = await supabase
    .from('monthly_bills')
    .select('*')
    .eq('billing_month', billingMonth)
    .neq('status', 'voided');
  if (error) throw error;
  return data ?? [];
}

export async function getBillWithDetails(billId: string): Promise<BillWithDetails> {
  const [billRes, itemsRes, adjustmentsRes, paymentsRes] = await Promise.all([
    supabase.from('monthly_bills').select('*').eq('id', billId).single(),
    supabase.from('bill_items').select('*').eq('bill_id', billId).order('delivery_date'),
    supabase.from('bill_adjustments').select('*').eq('bill_id', billId).order('created_at'),
    supabase.from('payments').select('*').eq('bill_id', billId).order('payment_date'),
  ]);
  if (billRes.error) throw billRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (adjustmentsRes.error) throw adjustmentsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  return {
    bill: billRes.data,
    items: itemsRes.data ?? [],
    adjustments: adjustmentsRes.data ?? [],
    payments: paymentsRes.data ?? [],
  };
}

export async function createDraftBill(
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

export async function recalculateDraftBill(billId: string): Promise<MonthlyBillRow> {
  const { data, error } = await supabase.rpc('recalculate_draft_bill', { p_bill_id: billId });
  if (error) throw error;
  return data;
}

export async function addBillAdjustment(
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

export async function finalizeBill(billId: string): Promise<MonthlyBillRow> {
  const { data, error } = await supabase.rpc('finalize_bill', { p_bill_id: billId });
  if (error) throw error;
  return data;
}

export async function voidBill(billId: string, reason: string): Promise<MonthlyBillRow> {
  const { data, error } = await supabase.rpc('void_bill', { p_bill_id: billId, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function acknowledgeBillFlag(billId: string): Promise<MonthlyBillRow> {
  const { data, error } = await supabase.rpc('acknowledge_bill_flag', { p_bill_id: billId });
  if (error) throw error;
  return data;
}

export async function markBillSent(billId: string): Promise<MonthlyBillRow> {
  const { data, error } = await supabase.rpc('mark_bill_sent', { p_bill_id: billId });
  if (error) throw error;
  return data;
}

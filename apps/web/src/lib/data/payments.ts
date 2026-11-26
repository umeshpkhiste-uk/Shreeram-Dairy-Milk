import type { Database, PaymentMethod } from '@shreeram/shared';

import type { MonthlyBillRow, PaymentRow } from './bills';
import type { SupabaseServerClient } from './types';

export type PaymentClaimRow = Database['public']['Tables']['payment_claims']['Row'];

export type RecordPaymentInput = {
  /**
   * Generated once by the caller (`crypto.randomUUID()`) when the admin
   * starts this payment attempt, and reused unchanged if a retry is needed
   * after a network failure — generating a fresh id per call here would
   * defeat the RPC's idempotency.
   */
  paymentId: string;
  billId: string;
  amountPaise: number;
  method: PaymentMethod;
  methodDetail: string | null;
  transactionReference: string | null;
  paymentDate: string; // YYYY-MM-DD
  notes: string | null;
};

export type RecordPaymentResult = { duplicate: boolean; bill: MonthlyBillRow };

/** Idempotent on `input.paymentId`. */
export async function recordPayment(
  supabase: SupabaseServerClient,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  const { data, error } = await supabase.rpc('record_payment', {
    p_payment_id: input.paymentId,
    p_bill_id: input.billId,
    p_amount_paise: input.amountPaise,
    p_method: input.method,
    p_method_detail: input.methodDetail,
    p_transaction_reference: input.transactionReference,
    p_payment_date: input.paymentDate,
    p_notes: input.notes,
  });
  if (error) throw error;
  return data as unknown as RecordPaymentResult;
}

export async function voidPayment(
  supabase: SupabaseServerClient,
  paymentId: string,
  reason: string,
): Promise<MonthlyBillRow> {
  const { data, error } = await supabase.rpc('void_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

/** Customers' "I have paid" details that no admin has checked yet, for one bill or all. */
export async function listPendingPaymentClaims(
  supabase: SupabaseServerClient,
  billId?: string,
): Promise<PaymentClaimRow[]> {
  let query = supabase.from('payment_claims').select('*').eq('status', 'pending').order('created_at');
  if (billId) query = query.eq('bill_id', billId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function submitPaymentClaim(
  supabase: SupabaseServerClient,
  billId: string,
  amountPaise: number,
  transactionReference: string,
): Promise<void> {
  const { error } = await supabase.rpc('submit_payment_claim', {
    p_bill_id: billId,
    p_amount_paise: amountPaise,
    p_transaction_reference: transactionReference,
  });
  if (error) throw error;
}

/** `received` records the payment; otherwise the claim is only put away. */
export async function resolvePaymentClaim(
  supabase: SupabaseServerClient,
  claimId: string,
  received: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('resolve_payment_claim', {
    p_claim_id: claimId,
    p_received: received,
  });
  if (error) throw error;
}

export async function listRecentPayments(
  supabase: SupabaseServerClient,
  limit = 50,
): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listPaymentsForBillIds(
  supabase: SupabaseServerClient,
  billIds: string[],
): Promise<PaymentRow[]> {
  if (billIds.length === 0) return [];
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .in('bill_id', billIds)
    .is('voided_at', null);
  if (error) throw error;
  return data ?? [];
}

/** Makes the UPI pay link on the customer's bill work for 1 more day; only once it has expired. */
export async function renewPaymentLink(supabase: SupabaseServerClient, billId: string): Promise<void> {
  const { error } = await supabase.rpc('renew_payment_link', { p_bill_id: billId });
  if (error) throw error;
}

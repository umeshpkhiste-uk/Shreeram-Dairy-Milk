'use server';

import { parseRupeesToPaise, parseSignedRupeesToPaise, type PaymentMethod } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  acknowledgeBillFlag,
  addBillAdjustment,
  createDraftBill,
  finalizeBill,
  markBillSent,
  recalculateDraftBill,
  voidBill,
} from '@/lib/data/bills';
import { recordPayment, voidPayment } from '@/lib/data/payments';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error: string | null };

export async function createDraftBillAction(customerId: string, billingMonth: string) {
  const supabase = await createClient();
  const bill = await createDraftBill(supabase, customerId, billingMonth);
  revalidatePath('/billing');
  redirect(`/billing/${bill.id}`);
}

export async function recalculateBillAction(billId: string) {
  const supabase = await createClient();
  await recalculateDraftBill(supabase, billId);
  revalidatePath(`/billing/${billId}`);
}

export async function finalizeBillAction(billId: string) {
  const supabase = await createClient();
  await finalizeBill(supabase, billId);
  revalidatePath(`/billing/${billId}`);
}

export async function acknowledgeBillFlagAction(billId: string) {
  const supabase = await createClient();
  await acknowledgeBillFlag(supabase, billId);
  revalidatePath(`/billing/${billId}`);
}

export async function markBillSentAction(billId: string) {
  const supabase = await createClient();
  await markBillSent(supabase, billId);
  revalidatePath(`/billing/${billId}`);
}

export async function voidBillAction(
  billId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) return { error: 'Enter a reason for voiding this bill.' };

  const supabase = await createClient();
  try {
    await voidBill(supabase, billId, reason);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to void the bill.' };
  }
  revalidatePath(`/billing/${billId}`);
  return { error: null };
}

export async function addAdjustmentAction(
  billId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const amountRupees = String(formData.get('amountRupees') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  const amountPaise = parseSignedRupeesToPaise(amountRupees);
  if (amountPaise === null) return { error: 'Enter a valid amount, e.g. -10 or 25.50' };
  if (reason.length < 3) return { error: 'Enter a reason for this adjustment.' };

  const supabase = await createClient();
  try {
    await addBillAdjustment(supabase, billId, amountPaise, reason);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add the adjustment.' };
  }
  revalidatePath(`/billing/${billId}`);
  return { error: null };
}

export async function recordPaymentAction(
  billId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const amountRupees = String(formData.get('amountRupees') ?? '');
  const method = String(formData.get('method') ?? '') as PaymentMethod;
  const methodDetail = String(formData.get('methodDetail') ?? '').trim();
  const transactionReference = String(formData.get('transactionReference') ?? '').trim();
  const paymentDate = String(formData.get('paymentDate') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  // Generated once by the client when the payment form was opened (a hidden
  // field, see payment-form.tsx) and reused unchanged on any retry — NOT
  // generated here, which would mint a new id on every submit and defeat
  // record_payment's idempotency. Same rule as the mobile app's
  // RecordPaymentInput.paymentId.
  const paymentId = String(formData.get('paymentId') ?? '');

  const amountPaise = parseRupeesToPaise(amountRupees);
  if (amountPaise === null || amountPaise <= 0) return { error: 'Enter a valid payment amount.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return { error: 'Choose a payment date.' };
  if (!method) return { error: 'Select a payment method.' };
  if (!paymentId) return { error: 'Missing payment id — reload the page and try again.' };

  const supabase = await createClient();
  try {
    await recordPayment(supabase, {
      paymentId,
      billId,
      amountPaise,
      method,
      methodDetail: methodDetail || null,
      transactionReference: transactionReference || null,
      paymentDate,
      notes: notes || null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to record the payment.' };
  }
  revalidatePath(`/billing/${billId}`);
  revalidatePath('/payments');
  return { error: null };
}

export async function voidPaymentAction(billId: string, paymentId: string, reason: string) {
  const supabase = await createClient();
  await voidPayment(supabase, paymentId, reason);
  revalidatePath(`/billing/${billId}`);
  revalidatePath('/payments');
}

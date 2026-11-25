'use server';

import {
  errorMessage,
  parseRupeesToPaise,
  parseSignedRupeesToPaise,
  type PaymentMethod,
} from '@shreeram/shared';
import { revalidatePath } from 'next/cache';
import { redirect, RedirectType } from 'next/navigation';

import {
  acknowledgeBillFlag,
  addBillAdjustment,
  cancelDraftBill,
  createDraftBill,
  finalizeBill,
  markBillSent,
  recalculateDraftBill,
  voidBill,
} from '@/lib/data/bills';
import { recordPayment, voidPayment } from '@/lib/data/payments';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error: string | null };

export async function createDraftBillAction(
  customerId: string,
  billingMonth: string,
): Promise<ActionState> {
  const supabase = await createClient();
  let billId: string;
  try {
    billId = (await createDraftBill(supabase, customerId, billingMonth)).id;
  } catch (err) {
    return { error: errorMessage(err, 'Failed to create the bill.') };
  }
  revalidatePath('/billing');
  redirect(`/billing/${billId}`);
}

export async function recalculateBillAction(billId: string): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await recalculateDraftBill(supabase, billId);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to recalculate the bill.') };
  }
  revalidatePath(`/billing/${billId}`);
  return { error: null };
}

export async function finalizeBillAction(billId: string): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await finalizeBill(supabase, billId);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to finalize the bill.') };
  }
  revalidatePath(`/billing/${billId}`);
  return { error: null };
}

export async function acknowledgeBillFlagAction(billId: string): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await acknowledgeBillFlag(supabase, billId);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to clear the flag.') };
  }
  revalidatePath(`/billing/${billId}`);
  return { error: null };
}

export async function markBillSentAction(billId: string): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await markBillSent(supabase, billId);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to mark the bill as sent.') };
  }
  revalidatePath(`/billing/${billId}`);
  return { error: null };
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
    return { error: errorMessage(err, 'Failed to void the bill.') };
  }
  revalidatePath(`/billing/${billId}`);
  return { error: null };
}

export async function cancelBillAction(billId: string, billingMonth: string): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await cancelDraftBill(supabase, billId);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to cancel the bill.') };
  }
  revalidatePath('/billing');
  // Replace, so Back doesn't return to the removed bill's page.
  redirect(`/billing?month=${billingMonth}`, RedirectType.replace);
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
    return { error: errorMessage(err, 'Failed to add the adjustment.') };
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
  // record_payment's idempotency.
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
    return { error: errorMessage(err, 'Failed to record the payment.') };
  }
  revalidatePath(`/billing/${billId}`);
  revalidatePath('/payments');
  return { error: null };
}

export async function voidPaymentAction(
  billId: string,
  paymentId: string,
  reason: string,
): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await voidPayment(supabase, paymentId, reason);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to void the payment.') };
  }
  revalidatePath(`/billing/${billId}`);
  revalidatePath('/payments');
  return { error: null };
}

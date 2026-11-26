'use server';

import {
  billMessage,
  errorMessage,
  parseRupeesToPaise,
  parseSignedRupeesToPaise,
  whatsappNumber,
  type PaymentMethod,
} from '@shreeram/shared';
import { revalidatePath } from 'next/cache';
import { redirect, RedirectType } from 'next/navigation';

import {
  acknowledgeBillFlag,
  addBillAdjustment,
  cancelDraftBill,
  createDraftBill,
  generateBill,
  getBillDocument,
  getBillWithDetails,
} from '@/lib/data/bills';
import { getCustomer } from '@/lib/data/customers';
import {
  recordPayment,
  renewPaymentLink,
  resolvePaymentClaim,
  voidPayment,
} from '@/lib/data/payments';
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

export async function generateBillAction(
  billId: string,
  link: string,
): Promise<{ error: string | null; phone: string; message: string }> {
  const supabase = await createClient();
  try {
    const bill = await generateBill(supabase, billId);
    const [customer, document] = await Promise.all([
      getCustomer(supabase, bill.customer_id),
      getBillDocument(supabase, billId),
    ]);
    if (!customer || !document) throw new Error('The bill could not be loaded.');
    revalidatePath(`/billing/${billId}`);
    return {
      error: null,
      phone: whatsappNumber(customer.billing_contact_phone || customer.mobile_number),
      message: billMessage(document, link),
    };
  } catch (err) {
    return { error: errorMessage(err, 'Failed to generate the bill.'), phone: '', message: '' };
  }
}

export async function renewPaymentLinkAction(
  billId: string,
  link: string,
): Promise<{ error: string | null; phone: string; message: string }> {
  const supabase = await createClient();
  try {
    await renewPaymentLink(supabase, billId);
    const [details, document] = await Promise.all([
      getBillWithDetails(supabase, billId),
      getBillDocument(supabase, billId),
    ]);
    const customer = details && (await getCustomer(supabase, details.bill.customer_id));
    if (!customer || !document) throw new Error('The bill could not be loaded.');
    revalidatePath(`/billing/${billId}`);
    return {
      error: null,
      phone: whatsappNumber(customer.billing_contact_phone || customer.mobile_number),
      message: billMessage(document, link),
    };
  } catch (err) {
    return { error: errorMessage(err, 'Failed to make a new payment link.'), phone: '', message: '' };
  }
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

export async function resolvePaymentClaimAction(
  billId: string,
  claimId: string,
  received: boolean,
): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await resolvePaymentClaim(supabase, claimId, received);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to save.') };
  }
  revalidatePath(`/billing/${billId}`);
  revalidatePath('/payments');
  revalidatePath('/inbox');
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
    return { error: errorMessage(err, 'Failed to undo the payment.') };
  }
  revalidatePath(`/billing/${billId}`);
  revalidatePath('/payments');
  return { error: null };
}

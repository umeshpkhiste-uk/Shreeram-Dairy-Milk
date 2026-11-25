'use server';

import { errorMessage, parseRupeesToPaise } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';

import { submitPaymentClaim } from '@/lib/data/payments';
import { createClient } from '@/lib/supabase/server';

type ActionState = { error: string | null };

/** Callable without signing in: submit_payment_claim does the checks. */
export async function claimPaymentAction(
  billId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const amountPaise = parseRupeesToPaise(String(formData.get('amountRupees') ?? ''));
  const reference = String(formData.get('reference') ?? '').replace(/\s/g, '');
  if (amountPaise === null || amountPaise <= 0) return { error: 'Enter the amount you paid.' };
  if (!/^\d{12}$/.test(reference)) return { error: 'Enter the 12-digit UPI transaction number.' };

  try {
    await submitPaymentClaim(await createClient(), billId, amountPaise, reference);
  } catch (err) {
    return { error: errorMessage(err, 'Your details could not be sent. Please try again.') };
  }
  revalidatePath(`/bill/${billId}`);
  return { error: null };
}

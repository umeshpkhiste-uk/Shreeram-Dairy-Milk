'use server';

import { errorMessage } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createDraftBill } from '@/lib/data/bills';
import { markDeliverySkipped, resolveDeliveryConflict } from '@/lib/data/deliveries';
import { createClient } from '@/lib/supabase/server';

type ActionState = { error: string | null };

export async function markSkippedAction(
  customerId: string,
  date: string,
  month: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const reason = String(formData.get('reason') ?? '').trim() || 'Customer informed — no delivery';
  const supabase = await createClient();
  try {
    await markDeliverySkipped(supabase, customerId, date, reason);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to mark the day.') };
  }
  revalidatePath(`/deliveries/${customerId}`);
  redirect(`/deliveries/${customerId}?month=${month}&day=${date}`);
}

export async function resolveConflictAction(
  customerId: string,
  date: string,
  month: string,
  deliveryId: string,
  eventId: string | null,
): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await resolveDeliveryConflict(supabase, deliveryId, eventId);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to resolve the conflict.') };
  }
  revalidatePath(`/deliveries/${customerId}`);
  redirect(`/deliveries/${customerId}?month=${month}&day=${date}`);
}

export async function createBillForMonthAction(
  customerId: string,
  month: string,
): Promise<ActionState> {
  const supabase = await createClient();
  let billId: string;
  try {
    billId = (await createDraftBill(supabase, customerId, month)).id;
  } catch (err) {
    return { error: errorMessage(err, 'Failed to create the bill.') };
  }
  redirect(`/billing/${billId}`);
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createDraftBill } from '@/lib/data/bills';
import { markDeliverySkipped } from '@/lib/data/deliveries';
import { createClient } from '@/lib/supabase/server';

export async function markSkippedAction(
  customerId: string,
  date: string,
  month: string,
  formData: FormData,
) {
  const reason = String(formData.get('reason') ?? '').trim() || 'Customer informed — no delivery';
  const supabase = await createClient();
  await markDeliverySkipped(supabase, customerId, date, reason);
  revalidatePath(`/deliveries/${customerId}`);
  redirect(`/deliveries/${customerId}?month=${month}&day=${date}`);
}

export async function createBillForMonthAction(customerId: string, month: string) {
  const supabase = await createClient();
  const bill = await createDraftBill(supabase, customerId, month);
  redirect(`/billing/${bill.id}`);
}

'use server';

import { parseRupeesToPaise } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';

import { setCustomerRate } from '@/lib/data/customer-rates';
import { createClient } from '@/lib/supabase/server';

export type RateActionState = { error: string | null };

export async function setCustomerRateAction(
  customerId: string,
  _prevState: RateActionState,
  formData: FormData,
): Promise<RateActionState> {
  const milkTypeId = String(formData.get('milkTypeId') ?? '');
  const priceRupees = String(formData.get('priceRupees') ?? '');
  const effectiveFrom = String(formData.get('effectiveFrom') ?? '');

  const pricePaise = parseRupeesToPaise(priceRupees);
  if (!milkTypeId) return { error: 'Select a milk type.' };
  if (pricePaise === null) return { error: 'Enter a valid price, e.g. 55 or 55.50' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return { error: 'Choose an effective date.' };

  const supabase = await createClient();
  try {
    await setCustomerRate(supabase, { customerId, milkTypeId, pricePaise, effectiveFrom });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to set the rate.' };
  }
  revalidatePath(`/customers/${customerId}`);
  return { error: null };
}

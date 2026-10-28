'use server';

import { parseRupeesToPaise } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';

import { createMilkType, updateMilkType } from '@/lib/data/milk-types';
import { updateBusinessSettings } from '@/lib/data/business-settings';
import { createClient } from '@/lib/supabase/server';

export type SettingsActionState = { error: string | null };

export async function updateBusinessSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const businessName = String(formData.get('businessName') ?? '').trim();
  if (!businessName) return { error: 'Enter a business name.' };

  const supabase = await createClient();
  try {
    await updateBusinessSettings(supabase, {
      businessName,
      contactPhone: String(formData.get('contactPhone') ?? '').trim() || null,
      contactEmail: String(formData.get('contactEmail') ?? '').trim() || null,
      address: String(formData.get('address') ?? '').trim() || null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save business settings.' };
  }
  revalidatePath('/settings');
  return { error: null };
}

export async function createMilkTypeAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const priceRupees = String(formData.get('priceRupees') ?? '');
  const defaultPricePaise = parseRupeesToPaise(priceRupees);

  if (name.length < 2) return { error: 'Enter a milk type name.' };
  if (defaultPricePaise === null) return { error: 'Enter a valid price, e.g. 55 or 55.50' };

  const supabase = await createClient();
  try {
    await createMilkType(supabase, { name, defaultPricePaise });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create milk type.' };
  }
  revalidatePath('/settings');
  return { error: null };
}

export async function updateMilkTypePriceAction(
  milkTypeId: string,
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const priceRupees = String(formData.get('priceRupees') ?? '');
  const defaultPricePaise = parseRupeesToPaise(priceRupees);
  if (defaultPricePaise === null) return { error: 'Enter a valid price, e.g. 55 or 55.50' };

  const supabase = await createClient();
  try {
    await updateMilkType(supabase, milkTypeId, { defaultPricePaise });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update price.' };
  }
  revalidatePath('/settings');
  return { error: null };
}

export async function toggleMilkTypeActiveAction(milkTypeId: string, isActive: boolean) {
  const supabase = await createClient();
  await updateMilkType(supabase, milkTypeId, { isActive });
  revalidatePath('/settings');
}

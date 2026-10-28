'use server';

import { parseRupeesToPaise, type ProductUnit } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';

import { updateBusinessSettings } from '@/lib/data/business-settings';
import { createProduct, updateProduct } from '@/lib/data/products';
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
      upiId: String(formData.get('upiId') ?? '').trim() || null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save business settings.' };
  }
  revalidatePath('/settings');
  return { error: null };
}

export async function createOrderItemAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const unit = String(formData.get('unit') ?? '') as ProductUnit;
  const priceRupees = String(formData.get('priceRupees') ?? '');
  const pricePaise = parseRupeesToPaise(priceRupees);

  if (name.length < 2) return { error: 'Enter an item name.' };
  if (unit !== 'litre' && unit !== 'kg') return { error: 'Select a unit.' };
  if (pricePaise === null) return { error: 'Enter a valid price, e.g. 55 or 55.50' };

  const supabase = await createClient();
  try {
    await createProduct(supabase, { name, unit, pricePaise });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add item.' };
  }
  revalidatePath('/settings');
  return { error: null };
}

export async function updateOrderItemPriceAction(
  productId: string,
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const priceRupees = String(formData.get('priceRupees') ?? '');
  const pricePaise = parseRupeesToPaise(priceRupees);
  if (pricePaise === null) return { error: 'Enter a valid price, e.g. 55 or 55.50' };

  const supabase = await createClient();
  try {
    await updateProduct(supabase, productId, { pricePaise });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update price.' };
  }
  revalidatePath('/settings');
  return { error: null };
}

export async function toggleOrderItemActiveAction(productId: string, isActive: boolean) {
  const supabase = await createClient();
  await updateProduct(supabase, productId, { isActive });
  revalidatePath('/settings');
}

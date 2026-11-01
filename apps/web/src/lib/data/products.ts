import type { Database, ProductUnit } from '@shreeram/shared';

import type { SupabaseServerClient } from './types';

export type ProductRow = Database['public']['Tables']['products']['Row'];

export async function listActiveProducts(supabase: SupabaseServerClient): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/** Admin-only (see products RLS) — includes inactive products too, for management. */
export async function listAllProducts(supabase: SupabaseServerClient): Promise<ProductRow[]> {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(
  supabase: SupabaseServerClient,
  input: { name: string; unit: ProductUnit; pricePaise: number },
): Promise<ProductRow> {
  const { data, error } = await supabase
    .from('products')
    .insert({ name: input.name, unit: input.unit, price_paise: input.pricePaise })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Always hard-deletes the product, even if it was used in a past order —
 * order_items.product_id is ON DELETE CASCADE (see migration
 * 20261102090000), so this also removes that order's line item for this
 * product. The order itself and its other items are untouched.
 */
export async function deleteProduct(supabase: SupabaseServerClient, id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function updateProduct(
  supabase: SupabaseServerClient,
  id: string,
  input: Partial<{ pricePaise: number; isActive: boolean }>,
): Promise<ProductRow> {
  const { data, error } = await supabase
    .from('products')
    .update({
      ...(input.pricePaise !== undefined ? { price_paise: input.pricePaise } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

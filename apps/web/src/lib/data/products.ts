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
 * Hard-deletes the product where possible. order_items.product_id has no
 * cascade (deleting a product used in a past order would silently blank its
 * name on that order's receipt/PDF), so a product already used in an order
 * is deactivated instead — the foreign-key violation (23503) is how we find
 * out it's in use, rather than checking order_items ourselves first.
 */
export async function deleteProduct(
  supabase: SupabaseServerClient,
  id: string,
): Promise<{ hardDeleted: boolean }> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (!error) return { hardDeleted: true };
  if (error.code !== '23503') throw error;

  const { error: deactivateError } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id);
  if (deactivateError) throw deactivateError;
  return { hardDeleted: false };
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

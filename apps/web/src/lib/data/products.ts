import type { Database } from '@shreeram/shared';

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

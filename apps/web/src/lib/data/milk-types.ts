import type { Database } from '@shreeram/shared';

import type { SupabaseServerClient } from './types';

export type MilkTypeRow = Database['public']['Tables']['milk_types']['Row'];

export async function listActiveMilkTypes(supabase: SupabaseServerClient): Promise<MilkTypeRow[]> {
  const { data, error } = await supabase
    .from('milk_types')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

/** Admin-only (see milk_types RLS) — includes inactive types too, for management. */
export async function listAllMilkTypes(supabase: SupabaseServerClient): Promise<MilkTypeRow[]> {
  const { data, error } = await supabase.from('milk_types').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createMilkType(
  supabase: SupabaseServerClient,
  input: { name: string; defaultPricePaise: number },
): Promise<MilkTypeRow> {
  const { data, error } = await supabase
    .from('milk_types')
    .insert({ name: input.name, default_price_paise: input.defaultPricePaise })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateMilkType(
  supabase: SupabaseServerClient,
  id: string,
  input: Partial<{ name: string; defaultPricePaise: number; isActive: boolean }>,
): Promise<MilkTypeRow> {
  const { data, error } = await supabase
    .from('milk_types')
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.defaultPricePaise !== undefined
        ? { default_price_paise: input.defaultPricePaise }
        : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

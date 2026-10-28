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

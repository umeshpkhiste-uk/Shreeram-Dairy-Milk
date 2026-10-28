import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

export type MilkTypeRow = Database['public']['Tables']['milk_types']['Row'];

export async function listActiveMilkTypes(): Promise<MilkTypeRow[]> {
  const { data, error } = await supabase
    .from('milk_types')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

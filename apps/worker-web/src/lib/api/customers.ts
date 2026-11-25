import type { Database } from '@shreeram/shared';

import { supabase } from '@/lib/supabase/client';

export type CustomerRow = Database['public']['Tables']['customers']['Row'];

export async function listCustomersForWorker(workerId: string): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('assigned_worker_id', workerId)
    .eq('status', 'active')
    .order('route_sequence', { ascending: true, nullsFirst: false })
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}

/** Puts product and quantity changes that start today on the customers, before listing them. */
export async function applyDueProductChanges(): Promise<void> {
  const { error } = await supabase.rpc('apply_due_product_changes');
  if (error) throw error;
}

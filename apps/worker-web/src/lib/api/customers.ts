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

import type { Database } from '@shreeram/shared';

import type { SupabaseServerClient } from './types';

export type SyncFailureRow = Database['public']['Tables']['sync_failures']['Row'];
export type DeliveryEventRow = Database['public']['Tables']['delivery_events']['Row'];

/** Records on workers' phones that the server refused, newest first. */
export async function listSyncFailures(supabase: SupabaseServerClient): Promise<SyncFailureRow[]> {
  const { data, error } = await supabase
    .from('sync_failures')
    .select('*')
    .is('dismissed_at', null)
    .order('reported_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function dismissSyncFailure(
  supabase: SupabaseServerClient,
  eventId: string,
): Promise<void> {
  const { error } = await supabase.rpc('dismiss_sync_failure', { p_event_id: eventId });
  if (error) throw error;
}

/** What workers' phones sent, newest first. */
export async function listReceivedRecords(
  supabase: SupabaseServerClient,
  limit: number,
): Promise<DeliveryEventRow[]> {
  const { data, error } = await supabase
    .from('delivery_events')
    .select('*')
    .order('server_received_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

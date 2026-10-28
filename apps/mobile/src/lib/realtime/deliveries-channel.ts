import { supabase } from '@/lib/supabase/client';

/**
 * Pushes dashboard/report screens to refresh when a delivery changes on the
 * server. Postgres Changes authorizes each event per-subscriber against the
 * table's existing RLS policy (deliveries_select_admin_or_own_worker, see
 * supabase/migrations/20261028090001_stage3_rls_policies.sql) — an admin
 * receives every change, a worker only their own; no separate Realtime
 * authorization setup is needed beyond the supabase_realtime publication
 * (supabase/migrations/20261028100000_stage4_realtime.sql).
 *
 * This is a push-based *supplement*, not the source of truth — screens keep
 * their own useFocusEffect pull-based refresh as the recovery path the
 * checklist asks for, in case an event is ever missed.
 */
export function subscribeToDeliveryChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('admin-deliveries-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

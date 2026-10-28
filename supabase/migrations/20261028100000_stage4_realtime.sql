-- Stage 4: admin delivery monitoring needs useful online updates (per the
-- Implementation Checklist), with the existing pull-based refresh
-- (useFocusEffect) as the recovery mechanism. Postgres Changes authorizes
-- each event per-subscriber against the table's existing RLS policies — the
-- deliveries_select_admin_or_own_worker policy from Stage 3 already governs
-- this correctly (an admin receives every change, a worker only their own).
-- No new RLS is needed, only opting the table into the publication.

alter publication supabase_realtime add table public.deliveries;

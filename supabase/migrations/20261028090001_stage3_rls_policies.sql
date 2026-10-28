-- Stage 3: Row-Level Security for deliveries / delivery_events /
-- delivery_sync_receipts.
--
-- Deliberately no insert/update policy for `authenticated` on any of these
-- three tables. The only way a row is created or changed is through
-- public.submit_delivery_event (SECURITY DEFINER, next migration), which
-- performs its own authorization checks internally. This keeps idempotency
-- and conflict handling in exactly one place.

alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;
alter table public.delivery_sync_receipts enable row level security;

-- deliveries -------------------------------------------------------------------

create policy "deliveries_select_admin_or_own_worker"
  on public.deliveries for select
  to authenticated
  using (public.is_admin() or worker_id = (select auth.uid()));

-- delivery_events ----------------------------------------------------------

create policy "delivery_events_select_admin_or_own_worker"
  on public.delivery_events for select
  to authenticated
  using (public.is_admin() or worker_id = (select auth.uid()));

-- delivery_sync_receipts ------------------------------------------------------
-- Admin-only: a worker doesn't need to read this table directly, the RPC's
-- return value already tells their own device what happened.

create policy "delivery_sync_receipts_select_admin_only"
  on public.delivery_sync_receipts for select
  to authenticated
  using (public.is_admin());

-- Audit trail: reuse the existing generic audit trigger for consistency with
-- customers/workers/customer_milk_rates. delivery_events/delivery_sync_receipts
-- are themselves already an audit trail and are not separately audited.

create trigger audit_deliveries
  after insert or update on public.deliveries
  for each row execute function public.audit_row_change();

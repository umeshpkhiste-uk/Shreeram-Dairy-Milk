-- Stage 6: security hardening.
--
-- Defect found during the Stage 6 production-readiness review: every worker-scoped
-- SELECT policy checked "is this assigned to me?" but not "am I still an active worker?".
-- submit_delivery_event (the only write path) already checks is_active, so a deactivated
-- worker could never create data — but with a still-unexpired JWT (Supabase access tokens
-- live up to an hour, and there is no server-side session revocation on deactivation) they
-- could still *read* their former customers' details and their own delivery history until
-- that token naturally expired. Closing that window here, the same way is_admin() already
-- works for admins.

create function public.is_active_worker()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'worker' and is_active
  );
$$;

revoke all on function public.is_active_worker() from public;
grant execute on function public.is_active_worker() to authenticated;

-- customers: a deactivated worker loses read access to their former customers immediately,
-- not just at next token refresh.
drop policy "customers_select_admin_or_assigned_worker" on public.customers;
create policy "customers_select_admin_or_assigned_worker"
  on public.customers for select
  to authenticated
  using (
    public.is_admin()
    or (assigned_worker_id = (select auth.uid()) and public.is_active_worker())
  );

-- routes: same for the worker's assigned route.
drop policy "routes_select_admin_or_assigned_worker" on public.routes;
create policy "routes_select_admin_or_assigned_worker"
  on public.routes for select
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_active_worker()
      and id in (select route_id from public.workers where id = (select auth.uid()))
    )
  );

-- deliveries / delivery_events: a deactivated worker loses read access to their own
-- delivery history too — they no longer have any legitimate reason to see it, and it may
-- contain another customer's address/quantity/pricing-derived amount.
drop policy "deliveries_select_admin_or_own_worker" on public.deliveries;
create policy "deliveries_select_admin_or_own_worker"
  on public.deliveries for select
  to authenticated
  using (
    public.is_admin()
    or (worker_id = (select auth.uid()) and public.is_active_worker())
  );

drop policy "delivery_events_select_admin_or_own_worker" on public.delivery_events;
create policy "delivery_events_select_admin_or_own_worker"
  on public.delivery_events for select
  to authenticated
  using (
    public.is_admin()
    or (worker_id = (select auth.uid()) and public.is_active_worker())
  );

-- profiles/workers "own row" policies are deliberately left unchanged: a deactivated
-- worker must still be able to read their own profile (role/is_active) so the app can show
-- the "pending activation" / deactivated state instead of just failing to load, and their
-- own `workers` row is not sensitive beyond what their own profile already reveals.

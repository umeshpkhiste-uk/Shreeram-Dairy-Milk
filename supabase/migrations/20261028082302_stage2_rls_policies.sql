-- Stage 2: Row-Level Security.
--
-- Authorization is enforced here, in PostgreSQL — never only by hiding UI
-- elements in the client. `workers.id` is always equal to the owning
-- `profiles.id` / `auth.uid()` (1:1), which keeps "is this my own row?"
-- checks simple throughout.

-- is_admin(): true iff the calling user has an active admin profile.
-- SECURITY DEFINER only to read the caller's own row regardless of the
-- profiles SELECT policy being evaluated; it never accepts caller-supplied
-- input and never reveals data about any other user, so it is safe to be
-- directly callable.
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Prevent a user from granting themselves admin access or reactivating/
-- deactivating their own account by updating their own profile row.
-- A trigger (not just RLS WITH CHECK) so it holds regardless of which
-- client or path performs the update.
create function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin()
     and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'Only an admin can change role or active status';
  end if;
  return new;
end;
$$;

create trigger prevent_self_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_privilege_escalation();

-- Force created_by on customers to the authenticated caller — never trust a
-- client-supplied value.
create function public.set_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by = auth.uid();
  return new;
end;
$$;

create trigger set_created_by
  before insert on public.customers
  for each row execute function public.set_created_by();

-- Enable RLS everywhere --------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.routes enable row level security;
alter table public.workers enable row level security;
alter table public.milk_types enable row level security;
alter table public.customers enable row level security;
alter table public.customer_milk_rates enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;

-- profiles ---------------------------------------------------------------------

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- No insert/delete policy: rows are created only by the handle_new_user
-- trigger (runs as table owner, bypasses RLS) and are never hard-deleted.

-- routes -------------------------------------------------------------------

create policy "routes_select_admin_or_assigned_worker"
  on public.routes for select
  to authenticated
  using (
    public.is_admin()
    or id in (select route_id from public.workers where id = (select auth.uid()))
  );

create policy "routes_admin_write"
  on public.routes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- workers --------------------------------------------------------------------

create policy "workers_select_own_or_admin"
  on public.workers for select
  to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "workers_admin_write"
  on public.workers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- milk_types -----------------------------------------------------------------

create policy "milk_types_select_any_authenticated"
  on public.milk_types for select
  to authenticated
  using (true);

create policy "milk_types_admin_write"
  on public.milk_types for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- customers --------------------------------------------------------------------
-- Workers see only customers currently assigned to them. Never customers
-- assigned to another worker, and never unrestricted financial data (pricing
-- lives in customer_milk_rates, which workers cannot read at all).

create policy "customers_select_admin_or_assigned_worker"
  on public.customers for select
  to authenticated
  using (public.is_admin() or assigned_worker_id = (select auth.uid()));

create policy "customers_admin_write"
  on public.customers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- customer_milk_rates ----------------------------------------------------------
-- Admin only, in both directions — pricing is not exposed to workers at all.

create policy "customer_milk_rates_admin_only"
  on public.customer_milk_rates for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- business_settings ------------------------------------------------------------

create policy "business_settings_select_any_authenticated"
  on public.business_settings for select
  to authenticated
  using (true);

create policy "business_settings_admin_write"
  on public.business_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- audit_logs ---------------------------------------------------------------
-- Admin can read. No one can write directly — only the audit triggers
-- (running as table owner) insert rows, so every mutation path is covered.

create policy "audit_logs_select_admin_only"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

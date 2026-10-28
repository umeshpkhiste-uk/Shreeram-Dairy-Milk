-- Stage 5: Row-Level Security for billing.
--
-- Admin-only, full stop — no worker policy at all on any of the four tables, same treatment
-- as customer_milk_rates: pricing/billing is never worker-visible. No insert/update/delete
-- grant to `authenticated` either — every write goes through an RPC (next migrations), which
-- performs its own admin check internally.

alter table public.monthly_bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.bill_adjustments enable row level security;
alter table public.payments enable row level security;

create policy "monthly_bills_select_admin_only"
  on public.monthly_bills for select
  to authenticated
  using (public.is_admin());

create policy "bill_items_select_admin_only"
  on public.bill_items for select
  to authenticated
  using (public.is_admin());

create policy "bill_adjustments_select_admin_only"
  on public.bill_adjustments for select
  to authenticated
  using (public.is_admin());

create policy "payments_select_admin_only"
  on public.payments for select
  to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.monthly_bills from authenticated, anon;
revoke insert, update, delete on public.bill_items from authenticated, anon;
revoke insert, update, delete on public.bill_adjustments from authenticated, anon;
revoke insert, update, delete on public.payments from authenticated, anon;

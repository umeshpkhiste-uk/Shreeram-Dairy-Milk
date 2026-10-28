-- The "<table>_admin_write" policies used `for all`, which includes SELECT —
-- so every query ran two permissive SELECT policies instead of one
-- (flagged by `supabase db advisors --type performance`). Split each into
-- insert/update/delete only, leaving exactly one SELECT policy per table.

-- routes
drop policy "routes_admin_write" on public.routes;
create policy "routes_admin_insert" on public.routes for insert to authenticated with check (public.is_admin());
create policy "routes_admin_update" on public.routes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "routes_admin_delete" on public.routes for delete to authenticated using (public.is_admin());

-- workers
drop policy "workers_admin_write" on public.workers;
create policy "workers_admin_insert" on public.workers for insert to authenticated with check (public.is_admin());
create policy "workers_admin_update" on public.workers for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "workers_admin_delete" on public.workers for delete to authenticated using (public.is_admin());

-- milk_types
drop policy "milk_types_admin_write" on public.milk_types;
create policy "milk_types_admin_insert" on public.milk_types for insert to authenticated with check (public.is_admin());
create policy "milk_types_admin_update" on public.milk_types for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "milk_types_admin_delete" on public.milk_types for delete to authenticated using (public.is_admin());

-- customers
drop policy "customers_admin_write" on public.customers;
create policy "customers_admin_insert" on public.customers for insert to authenticated with check (public.is_admin());
create policy "customers_admin_update" on public.customers for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "customers_admin_delete" on public.customers for delete to authenticated using (public.is_admin());

-- customer_milk_rates (already admin-only for all actions, but split for
-- consistency and to avoid the same multi-policy SELECT cost)
drop policy "customer_milk_rates_admin_only" on public.customer_milk_rates;
create policy "customer_milk_rates_admin_select" on public.customer_milk_rates for select to authenticated using (public.is_admin());
create policy "customer_milk_rates_admin_insert" on public.customer_milk_rates for insert to authenticated with check (public.is_admin());
create policy "customer_milk_rates_admin_update" on public.customer_milk_rates for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "customer_milk_rates_admin_delete" on public.customer_milk_rates for delete to authenticated using (public.is_admin());

-- customer_milk_rates.created_by was never set automatically (unlike
-- customers.created_by, which has set_created_by from stage2_rls_policies).
-- Reuse the same trigger function — it just sets `new.created_by =
-- auth.uid()`, which works for any table with that column.

create trigger set_created_by
  before insert on public.customer_milk_rates
  for each row execute function public.set_created_by();

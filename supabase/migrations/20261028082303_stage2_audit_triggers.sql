-- Stage 2: audit trail.
--
-- A single generic trigger function, attached to every table whose changes
-- matter for accountability: role/active-status changes (profiles), worker
-- creation and route reassignment (workers), customer creation and
-- reassignment/status changes (customers), and price changes
-- (customer_milk_rates). Runs as table owner (SECURITY DEFINER), so it
-- cannot be bypassed by any client path and audit_logs itself stays
-- unwritable directly (see audit_logs RLS policy).

create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_profiles
  after insert or update on public.profiles
  for each row execute function public.audit_row_change();

create trigger audit_workers
  after insert or update on public.workers
  for each row execute function public.audit_row_change();

create trigger audit_customers
  after insert or update on public.customers
  for each row execute function public.audit_row_change();

create trigger audit_customer_milk_rates
  after insert or update on public.customer_milk_rates
  for each row execute function public.audit_row_change();

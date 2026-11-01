-- Owner request: bill numbers must read as monthly, not day-by-day.
-- Replaces SDDS-<DDMMYY of creation day>-<seq resetting daily> (20261030110000)
-- with SDDS-<MMYY of the BILLING MONTH>-<seq resetting monthly>, e.g.
-- SDDS-1126-0001 is the first bill for November 2026, whatever day it was
-- created on. A column default can't read another column, so this is set by
-- a BEFORE INSERT trigger from NEW.billing_month instead.

create table public.bill_number_month_counters (
  billing_month date primary key,
  last_sequence integer not null default 0
);

comment on table public.bill_number_month_counters is
  'One row per billing month — backs assign_monthly_bill_number()''s per-month sequence.';

-- No policies: only the security-definer trigger function touches it.
alter table public.bill_number_month_counters enable row level security;

create function public.next_monthly_bill_number(p_billing_month date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  -- Single-statement atomic increment, so concurrent inserts never collide.
  insert into public.bill_number_month_counters (billing_month, last_sequence)
  values (p_billing_month, 1)
  on conflict (billing_month) do update
    set last_sequence = public.bill_number_month_counters.last_sequence + 1
  returning last_sequence into v_seq;

  return 'SDDS-' || to_char(p_billing_month, 'MMYY') || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

revoke all on function public.next_monthly_bill_number(date) from public, anon, authenticated;

create function public.assign_monthly_bill_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.bill_number := public.next_monthly_bill_number(new.billing_month);
  return new;
end;
$$;

revoke all on function public.assign_monthly_bill_number() from public, anon, authenticated;

alter table public.monthly_bills alter column bill_number drop default;

create trigger assign_monthly_bill_number
  before insert on public.monthly_bills
  for each row execute function public.assign_monthly_bill_number();

-- Renumber bills that were never issued to a customer (draft, not marked
-- sent) into the new monthly format. Finalized/sent/voided bills keep the
-- number the customer may already have seen.
do $$
declare
  r record;
begin
  for r in
    select id, billing_month
    from public.monthly_bills
    where status = 'draft' and sent_at is null
    order by billing_month, created_at
  loop
    update public.monthly_bills
      set bill_number = public.next_monthly_bill_number(r.billing_month)
      where id = r.id;
  end loop;
end;
$$;

drop function public.next_bill_number();
drop table public.bill_number_counters;

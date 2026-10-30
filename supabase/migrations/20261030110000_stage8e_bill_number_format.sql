-- New bill numbers: SDDS-<DDMMYY>-<0001, resetting daily>. Replaces the old
-- flat SDM-000001 global sequence. Existing bills keep their old numbers —
-- bill_number is only ever set once, at insert, so this only affects bills
-- created from here on.

create table public.bill_number_counters (
  bill_date date primary key,
  last_sequence integer not null default 0
);

comment on table public.bill_number_counters is
  'One row per calendar day (Asia/Kolkata) a bill was created on — backs next_bill_number()''s per-day sequence.';

-- No policies: nobody needs direct access. Only next_bill_number() (security
-- definer) touches this table, implicitly via the bill_number column default.
alter table public.bill_number_counters enable row level security;

create function public.next_bill_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (now() at time zone 'Asia/Kolkata')::date;
  v_seq integer;
begin
  -- Atomic per-day increment: the INSERT ... ON CONFLICT DO UPDATE is a
  -- single statement, so concurrent callers never race to the same number
  -- (unlike a plain SELECT count(*) + 1).
  insert into public.bill_number_counters (bill_date, last_sequence)
  values (v_date, 1)
  on conflict (bill_date) do update set last_sequence = public.bill_number_counters.last_sequence + 1
  returning last_sequence into v_seq;

  return 'SDDS-' || to_char(v_date, 'DDMMYY') || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

alter table public.monthly_bills
  alter column bill_number set default public.next_bill_number();

drop sequence public.bill_number_seq;

-- Fix: the CASE expression's branches were untyped text literals, which Postgres resolves to
-- `text` as a whole (not the `unknown` literal type that gets implicitly cast at the UPDATE
-- target) once wrapped in CASE — so `update ... set status = case ... end` failed with
-- "column is of type bill_status but expression is of type text". Explicit casts fix it.
-- Found live-testing record_payment against the real project before any client code shipped.

create or replace function public._recompute_bill_status(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.bill_status;
  v_total_payable bigint;
  v_total_paid bigint;
begin
  select status, total_payable_paise into v_status, v_total_payable
  from public.monthly_bills where id = p_bill_id;

  if v_status in ('draft', 'voided') then
    return;
  end if;

  select coalesce(sum(amount_paise), 0) into v_total_paid
  from public.payments where bill_id = p_bill_id and voided_at is null;

  update public.monthly_bills
  set status = case
    when v_total_paid >= v_total_payable then 'paid'::public.bill_status
    when v_total_paid > 0 then 'partially_paid'::public.bill_status
    else 'finalized'::public.bill_status
  end
  where id = p_bill_id;
end;
$$;

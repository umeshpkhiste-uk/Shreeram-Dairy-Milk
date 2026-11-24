-- Owner request: cancelling a draft bill removes it completely (void_bill
-- keeps it, marked voided). Draft only: a draft can't have been sent or paid.
-- Its items and adjustments go with it (on delete cascade), which frees the
-- deliveries for a new bill. A copy of the bill stays in audit_logs.
create function public.cancel_draft_bill(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.monthly_bills;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_bill from public.monthly_bills where id = p_bill_id for update;
  if v_bill.id is null then
    raise exception 'Bill not found';
  end if;
  if v_bill.status <> 'draft' then
    raise exception 'Only a draft bill can be cancelled (current status: %)', v_bill.status;
  end if;
  -- A later bill carries this one's total in its previous balance; removing
  -- this one would leave the customer owing money no bill explains.
  if exists (
    select 1 from public.monthly_bills
    where customer_id = v_bill.customer_id
      and billing_month > v_bill.billing_month
      and status <> 'voided'
  ) then
    raise exception 'A later bill for this customer already includes this balance. Cancel or void that bill first.';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data)
  values (auth.uid(), 'DELETE', 'monthly_bills', v_bill.id, to_jsonb(v_bill));

  delete from public.monthly_bills where id = p_bill_id;
end;
$$;

comment on function public.cancel_draft_bill is
  'Admin-only: permanently deletes a draft bill, keeping a copy in audit_logs.';

revoke all on function public.cancel_draft_bill(uuid) from public, anon;
grant execute on function public.cancel_draft_bill(uuid) to authenticated;

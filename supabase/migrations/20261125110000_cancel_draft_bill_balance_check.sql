-- Fix: cancel_draft_bill refused any bill with a later one, even a zero bill
-- or one created after the later bill, whose balance that bill can't include.
-- Now refused only when a later bill really carries this one's balance, and
-- the message names that bill.
create or replace function public.cancel_draft_bill(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.monthly_bills;
  v_later public.monthly_bills;
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

  if v_bill.total_payable_paise <> 0 then
    -- The latest one, so cancelling in the order the messages give works.
    select * into v_later from public.monthly_bills
    where customer_id = v_bill.customer_id
      and billing_month > v_bill.billing_month
      and created_at > v_bill.created_at
      and status <> 'voided'
    order by billing_month desc
    limit 1;
    if v_later.id is not null then
      raise exception 'Bill % (%) already includes this bill''s balance. Cancel or void that bill first.',
        v_later.bill_number, to_char(v_later.billing_month, 'FMMonth YYYY');
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data)
  values (auth.uid(), 'DELETE', 'monthly_bills', v_bill.id, to_jsonb(v_bill));

  delete from public.monthly_bills where id = p_bill_id;
end;
$$;

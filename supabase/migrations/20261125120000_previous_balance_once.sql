-- Fix: create_draft_bill summed total_payable over every earlier bill, but each
-- total already includes the balance carried from the bills before it, so two
-- or more unpaid months were counted twice. The previous balance is now each
-- earlier bill's own charges (deliveries + adjustments) less all payments.
-- Existing bills are not changed.
create or replace function public.create_draft_bill(p_customer_id uuid, p_billing_month date)
returns public.monthly_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_billing_month)::date;
  v_bill_id uuid;
  v_prior_charges bigint;
  v_prior_paid bigint;
  v_previous_balance bigint;
  v_bill public.monthly_bills;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if exists (
    select 1 from public.monthly_bills
    where customer_id = p_customer_id and billing_month = v_month and status <> 'voided'
  ) then
    raise exception 'A bill already exists for this customer and billing month';
  end if;

  select coalesce(sum(subtotal_paise + adjustments_total_paise), 0) into v_prior_charges
  from public.monthly_bills
  where customer_id = p_customer_id and billing_month < v_month and status <> 'voided';

  select coalesce(sum(amount_paise), 0) into v_prior_paid
  from public.payments
  where voided_at is null and bill_id in (
    select id from public.monthly_bills
    where customer_id = p_customer_id and billing_month < v_month and status <> 'voided'
  );

  v_previous_balance := v_prior_charges - v_prior_paid;

  insert into public.monthly_bills (customer_id, billing_month, previous_outstanding_balance_paise)
  values (p_customer_id, v_month, v_previous_balance)
  returning id into v_bill_id;

  perform public._populate_bill_items(v_bill_id);

  select * into v_bill from public.monthly_bills where id = v_bill_id;
  return v_bill;
end;
$$;

-- A later bill now carries only this bill's own charges, so cancel_draft_bill
-- must check those: a bill holding nothing but an older balance is safe to remove.
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

  if v_bill.subtotal_paise + v_bill.adjustments_total_paise <> 0 then
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

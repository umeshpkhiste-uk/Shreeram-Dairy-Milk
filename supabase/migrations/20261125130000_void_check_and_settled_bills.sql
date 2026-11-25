-- 1. void_bill gets the check cancel_draft_bill has: not while a later bill
--    carries this bill's balance.
-- 2. A bill also counts as paid once the customer owes nothing up to it or a
--    later finalized bill, e.g. the latest bill, which includes the older
--    balance, was paid in full. Voiding that payment turns it back.

-- What a later bill carries is this bill's own charges less what had been paid
-- on it when the later bill was made (a payment voided since still counted then).
create function public._assert_balance_not_carried(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_later public.monthly_bills;
begin
  -- The latest one, so clearing them in the order the messages give works.
  select l.* into v_later
  from public.monthly_bills b
  join public.monthly_bills l
    on l.customer_id = b.customer_id
    and l.billing_month > b.billing_month
    and l.created_at > b.created_at
    and l.status <> 'voided'
  where b.id = p_bill_id
    and b.subtotal_paise + b.adjustments_total_paise <> (
      select coalesce(sum(p.amount_paise), 0)
      from public.payments p
      where p.bill_id = b.id
        and p.created_at < l.created_at
        and (p.voided_at is null or p.voided_at > l.created_at)
    )
  order by l.billing_month desc
  limit 1;

  if v_later.id is not null then
    raise exception 'Bill % (%) already includes this bill''s balance. Cancel or void that bill first.',
      v_later.bill_number, to_char(v_later.billing_month, 'FMMonth YYYY');
  end if;
end;
$$;

revoke all on function public._assert_balance_not_carried(uuid) from public, anon, authenticated;

create function public._recompute_customer_bill_statuses(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with bills as (
    select b.id, b.status, b.billing_month, b.total_payable_paise,
      b.subtotal_paise + b.adjustments_total_paise as own_charges,
      (
        select coalesce(sum(p.amount_paise), 0)
        from public.payments p where p.bill_id = b.id and p.voided_at is null
      ) as paid
    from public.monthly_bills b
    where b.customer_id = p_customer_id and b.status <> 'voided'
  ), running as (
    select *, sum(own_charges - paid) over (order by billing_month) as balance from bills
  ), settled as (
    -- The lowest balance reached at this bill or after it. A draft is not a
    -- settling point, but its charges count, as they do in the next bill.
    select *, min(case when status <> 'draft' then balance end) over (
      order by billing_month rows between current row and unbounded following
    ) as lowest_balance
    from running
  ), derived as (
    select id, (case
      when paid >= total_payable_paise or lowest_balance <= 0 then 'paid'
      when paid > 0 then 'partially_paid'
      else 'finalized'
    end)::public.bill_status as status
    from settled
    where status <> 'draft'
  )
  update public.monthly_bills b
  set status = d.status
  from derived d
  where b.id = d.id and b.status <> d.status;
end;
$$;

revoke all on function public._recompute_customer_bill_statuses(uuid) from public, anon, authenticated;

-- Called by record_payment, void_payment and add_bill_adjustment.
create or replace function public._recompute_bill_status(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._recompute_customer_bill_statuses(customer_id)
  from public.monthly_bills where id = p_bill_id;
end;
$$;

create or replace function public.finalize_bill(p_bill_id uuid)
returns public.monthly_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.bill_status;
  v_bill public.monthly_bills;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select status into v_status from public.monthly_bills where id = p_bill_id for update;
  if v_status is null then
    raise exception 'Bill not found';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft bill can be finalized (current status: %)', v_status;
  end if;

  update public.monthly_bills
  set status = 'finalized', finalized_at = now(), finalized_by = auth.uid()
  where id = p_bill_id;

  perform public._recompute_bill_status(p_bill_id);

  select * into v_bill from public.monthly_bills where id = p_bill_id;
  return v_bill;
end;
$$;

create or replace function public.void_bill(p_bill_id uuid, p_reason text)
returns public.monthly_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.bill_status;
  v_bill public.monthly_bills;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to void a bill';
  end if;

  select status into v_status from public.monthly_bills where id = p_bill_id for update;
  if v_status is null then
    raise exception 'Bill not found';
  end if;
  if v_status = 'voided' then
    raise exception 'Bill is already voided';
  end if;
  perform public._assert_balance_not_carried(p_bill_id);

  -- Free its deliveries for a future bill — the double-billing guard only excludes
  -- non-voided items.
  update public.bill_items set voided = true where bill_id = p_bill_id;

  update public.monthly_bills
  set status = 'voided', voided_at = now(), void_reason = p_reason
  where id = p_bill_id;

  perform public._recompute_bill_status(p_bill_id);

  select * into v_bill from public.monthly_bills where id = p_bill_id;
  return v_bill;
end;
$$;

create or replace function public.cancel_draft_bill(p_bill_id uuid)
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
  perform public._assert_balance_not_carried(p_bill_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data)
  values (auth.uid(), 'DELETE', 'monthly_bills', v_bill.id, to_jsonb(v_bill));

  delete from public.monthly_bills where id = p_bill_id;

  perform public._recompute_customer_bill_statuses(v_bill.customer_id);
end;
$$;

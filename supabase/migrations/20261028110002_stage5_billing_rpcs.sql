-- Stage 5: billing RPCs. All SECURITY DEFINER, admin-checked internally — the only write
-- path for monthly_bills/bill_items/bill_adjustments, mirroring submit_delivery_event's shape
-- from Stage 3. Three private helpers (prefixed `_`, not directly callable — EXECUTE is
-- revoked from every role below; they only ever run from inside another SECURITY DEFINER
-- function, which executes as the function owner regardless of those revokes) keep the
-- financial arithmetic in one place.

-- _populate_bill_items: (re)selects this bill's billable deliveries from scratch and recomputes
-- subtotal/total. Used by both create_draft_bill (on an empty bill) and recalculate_draft_bill.
create function public._populate_bill_items(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_month date;
  v_period_end date;
begin
  select customer_id, billing_month into v_customer_id, v_month
  from public.monthly_bills where id = p_bill_id;

  v_period_end := (v_month + interval '1 month')::date;

  delete from public.bill_items where bill_id = p_bill_id;

  insert into public.bill_items (bill_id, delivery_id, delivery_date, milk_type_id, quantity_ml, price_paise, amount_paise)
  select
    p_bill_id,
    d.id,
    d.delivery_date,
    d.milk_type_id,
    d.delivered_quantity_ml,
    d.price_paise_snapshot,
    round((d.price_paise_snapshot::numeric * d.delivered_quantity_ml::numeric) / 1000)::bigint
  from public.deliveries d
  where d.customer_id = v_customer_id
    and d.delivery_date >= v_month
    and d.delivery_date < v_period_end
    and d.status in ('completed', 'partial')
    and not exists (
      select 1 from public.bill_items bi where bi.delivery_id = d.id and not bi.voided
    );

  perform public._recompute_bill_financials(p_bill_id);
end;
$$;

-- _recompute_bill_financials: subtotal/adjustments/total from the bill's current line items
-- and adjustments. Never touches status.
create function public._recompute_bill_financials(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal bigint;
  v_adjustments bigint;
begin
  select coalesce(sum(amount_paise), 0) into v_subtotal
  from public.bill_items where bill_id = p_bill_id and not voided;

  select coalesce(sum(amount_paise), 0) into v_adjustments
  from public.bill_adjustments where bill_id = p_bill_id;

  update public.monthly_bills
  set subtotal_paise = v_subtotal,
      adjustments_total_paise = v_adjustments,
      total_payable_paise = previous_outstanding_balance_paise + v_subtotal + v_adjustments
  where id = p_bill_id;
end;
$$;

-- _recompute_bill_status: payment-driven status (finalized/partially_paid/paid) only —
-- draft and voided are set only by their own explicit actions, never derived here.
create function public._recompute_bill_status(p_bill_id uuid)
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
    when v_total_paid >= v_total_payable then 'paid'
    when v_total_paid > 0 then 'partially_paid'
    else 'finalized'
  end
  where id = p_bill_id;
end;
$$;

revoke all on function public._populate_bill_items(uuid) from public, anon, authenticated;
revoke all on function public._recompute_bill_financials(uuid) from public, anon, authenticated;
revoke all on function public._recompute_bill_status(uuid) from public, anon, authenticated;

-- create_draft_bill ---------------------------------------------------------------

create function public.create_draft_bill(p_customer_id uuid, p_billing_month date)
returns public.monthly_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_billing_month)::date;
  v_bill_id uuid;
  v_prior_total bigint;
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

  select coalesce(sum(total_payable_paise), 0) into v_prior_total
  from public.monthly_bills
  where customer_id = p_customer_id and billing_month < v_month and status <> 'voided';

  select coalesce(sum(amount_paise), 0) into v_prior_paid
  from public.payments
  where voided_at is null and bill_id in (
    select id from public.monthly_bills
    where customer_id = p_customer_id and billing_month < v_month and status <> 'voided'
  );

  v_previous_balance := v_prior_total - v_prior_paid;

  insert into public.monthly_bills (customer_id, billing_month, previous_outstanding_balance_paise)
  values (p_customer_id, v_month, v_previous_balance)
  returning id into v_bill_id;

  perform public._populate_bill_items(v_bill_id);

  select * into v_bill from public.monthly_bills where id = v_bill_id;
  return v_bill;
end;
$$;

-- recalculate_draft_bill ------------------------------------------------------------

create function public.recalculate_draft_bill(p_bill_id uuid)
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
    raise exception 'Only a draft bill can be recalculated (current status: %)', v_status;
  end if;

  perform public._populate_bill_items(p_bill_id);

  select * into v_bill from public.monthly_bills where id = p_bill_id;
  return v_bill;
end;
$$;

-- add_bill_adjustment ----------------------------------------------------------------

create function public.add_bill_adjustment(p_bill_id uuid, p_amount_paise bigint, p_reason text)
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
    raise exception 'A reason is required for a bill adjustment';
  end if;

  select status into v_status from public.monthly_bills where id = p_bill_id for update;
  if v_status is null then
    raise exception 'Bill not found';
  end if;
  if v_status = 'voided' then
    raise exception 'Cannot adjust a voided bill';
  end if;

  insert into public.bill_adjustments (bill_id, amount_paise, reason, created_by)
  values (p_bill_id, p_amount_paise, p_reason, auth.uid());

  perform public._recompute_bill_financials(p_bill_id);
  perform public._recompute_bill_status(p_bill_id);

  select * into v_bill from public.monthly_bills where id = p_bill_id;
  return v_bill;
end;
$$;

-- finalize_bill -----------------------------------------------------------------------

create function public.finalize_bill(p_bill_id uuid)
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

  select * into v_bill from public.monthly_bills where id = p_bill_id;
  return v_bill;
end;
$$;

-- void_bill ---------------------------------------------------------------------------

create function public.void_bill(p_bill_id uuid, p_reason text)
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

  -- Free its deliveries for a future bill — the double-billing guard only excludes
  -- non-voided items.
  update public.bill_items set voided = true where bill_id = p_bill_id;

  update public.monthly_bills
  set status = 'voided', voided_at = now(), void_reason = p_reason
  where id = p_bill_id;

  select * into v_bill from public.monthly_bills where id = p_bill_id;
  return v_bill;
end;
$$;

-- acknowledge_bill_flag ---------------------------------------------------------------

create function public.acknowledge_bill_flag(p_bill_id uuid)
returns public.monthly_bills
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

  update public.monthly_bills
  set flagged_for_review = false, flagged_reason = null
  where id = p_bill_id;

  select * into v_bill from public.monthly_bills where id = p_bill_id;
  if v_bill.id is null then
    raise exception 'Bill not found';
  end if;
  return v_bill;
end;
$$;

-- mark_bill_sent ------------------------------------------------------------------------
-- A deliberate admin confirmation, never set just because a share sheet opened — see
-- docs/billing.md.

create function public.mark_bill_sent(p_bill_id uuid)
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
  if v_status = 'draft' then
    raise exception 'Finalize the bill before marking it sent';
  end if;

  update public.monthly_bills set sent_at = now() where id = p_bill_id;

  select * into v_bill from public.monthly_bills where id = p_bill_id;
  return v_bill;
end;
$$;

revoke all on function public.create_draft_bill(uuid, date) from public, anon;
revoke all on function public.recalculate_draft_bill(uuid) from public, anon;
revoke all on function public.add_bill_adjustment(uuid, bigint, text) from public, anon;
revoke all on function public.finalize_bill(uuid) from public, anon;
revoke all on function public.void_bill(uuid, text) from public, anon;
revoke all on function public.acknowledge_bill_flag(uuid) from public, anon;
revoke all on function public.mark_bill_sent(uuid) from public, anon;

grant execute on function public.create_draft_bill(uuid, date) to authenticated;
grant execute on function public.recalculate_draft_bill(uuid) to authenticated;
grant execute on function public.add_bill_adjustment(uuid, bigint, text) to authenticated;
grant execute on function public.finalize_bill(uuid) to authenticated;
grant execute on function public.void_bill(uuid, text) to authenticated;
grant execute on function public.acknowledge_bill_flag(uuid) to authenticated;
grant execute on function public.mark_bill_sent(uuid) to authenticated;

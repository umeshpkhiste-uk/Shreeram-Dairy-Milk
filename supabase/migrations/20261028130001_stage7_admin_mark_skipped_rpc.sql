-- Admin-only write path for the 'skipped' delivery status (customer
-- informed the business in advance not to deliver that day). Deliberately
-- NOT routed through submit_delivery_event: that RPC hard-requires the
-- caller to be the customer's own assigned worker (never trusts a client to
-- name an arbitrary customer), which is correct for the offline worker sync
-- path but wrong here — this is an admin, acting from the website, for any
-- customer. SECURITY DEFINER with its own is_admin() check, mirroring the
-- Stage 5 billing RPCs' pattern.
--
-- deliveries.worker_id is not null, so a skip can only be recorded for a
-- customer that currently has an assigned worker (attributed to them, same
-- as a normal delivery would be) — callers should check for an assignment
-- first and guide the admin to set one if missing.
create function public.admin_mark_delivery_skipped(
  p_customer_id uuid,
  p_delivery_date date,
  p_reason text
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_customer public.customers;
  v_delivery public.deliveries;
  v_price_paise bigint;
begin
  if v_admin_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin() then
    raise exception 'Only an admin can mark a delivery skipped';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to mark a delivery skipped';
  end if;

  select * into v_customer from public.customers where id = p_customer_id;
  if v_customer.id is null then
    raise exception 'Customer % not found', p_customer_id;
  end if;
  if v_customer.assigned_worker_id is null then
    raise exception 'Customer has no assigned worker yet — assign one before marking a skip';
  end if;

  v_price_paise := public.resolve_milk_price_paise(
    p_customer_id, v_customer.milk_type_id, p_delivery_date
  );

  select * into v_delivery from public.deliveries
    where customer_id = p_customer_id and delivery_date = p_delivery_date
    for update;

  if v_delivery.id is not null then
    if v_delivery.status in ('completed', 'partial') then
      raise exception 'This day already has a recorded delivery and cannot be marked skipped';
    end if;

    update public.deliveries set
      status = 'skipped',
      delivered_quantity_ml = 0,
      reason = p_reason,
      version = version + 1
    where id = v_delivery.id
    returning * into v_delivery;
  else
    insert into public.deliveries (
      id, customer_id, worker_id, milk_type_id, delivery_date,
      scheduled_quantity_ml, delivered_quantity_ml, status, reason,
      price_paise_snapshot, device_recorded_at, version, created_by
    ) values (
      gen_random_uuid(), p_customer_id, v_customer.assigned_worker_id, v_customer.milk_type_id,
      p_delivery_date, v_customer.default_daily_quantity_ml, 0, 'skipped', p_reason,
      v_price_paise, now(), 1, v_admin_id
    )
    returning * into v_delivery;
  end if;

  return v_delivery;
end;
$$;

comment on function public.admin_mark_delivery_skipped is
  'Admin-only: marks a customer''s day as skipped (customer informed in advance), excluded from billing like missed. Cannot overwrite an already completed/partial day.';

revoke all on function public.admin_mark_delivery_skipped(uuid, date, text) from public, anon;
grant execute on function public.admin_mark_delivery_skipped(uuid, date, text) to authenticated;

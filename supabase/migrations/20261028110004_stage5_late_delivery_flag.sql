-- Stage 5: late-arriving offline deliveries must never silently change a finalized bill.
--
-- Redefines submit_delivery_event (Stage 3) to add one block: after applying or conflicting
-- an event, if a finalized/partially_paid/paid bill already exists for that customer's
-- billing period, flag it for admin review instead of touching its numbers. A pure duplicate
-- retry (the early-return path) is unchanged — it carries no new information.

create or replace function public.submit_delivery_event(
  p_event_id uuid,
  p_delivery_id uuid,
  p_customer_id uuid,
  p_milk_type_id uuid,
  p_delivery_date date,
  p_event_type public.delivery_event_type,
  p_status public.delivery_status,
  p_delivered_quantity_ml integer,
  p_reason text,
  p_expected_version integer,
  p_device_recorded_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id uuid := auth.uid();
  v_delivery public.deliveries;
  v_scheduled_quantity_ml integer;
  v_price_paise bigint;
  v_outcome text;
  v_applied boolean := false;
  v_conflict boolean := false;
  v_receipt public.delivery_sync_receipts;
begin
  if v_worker_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_worker_id and role = 'worker' and is_active
  ) then
    raise exception 'Only an active worker can submit delivery events';
  end if;

  if p_event_type = 'corrected' and p_expected_version is null then
    raise exception 'expected_version is required for a correction event';
  end if;

  if p_delivery_date > ((now() at time zone 'Asia/Kolkata')::date) then
    raise exception 'delivery_date cannot be in the future';
  end if;

  -- Idempotency: a retried upload reuses the same event id. Answer from the
  -- stored receipt without reprocessing anything.
  select * into v_receipt from public.delivery_sync_receipts where event_id = p_event_id;
  if found then
    select * into v_delivery from public.deliveries where id = v_receipt.delivery_id;
    return jsonb_build_object(
      'applied', v_receipt.outcome = 'applied',
      'duplicate', true,
      'conflict', v_receipt.outcome like 'conflict%',
      'outcome', v_receipt.outcome,
      'delivery', to_jsonb(v_delivery)
    );
  end if;

  -- Never trust a worker's device to name an arbitrary customer: the
  -- assignment must be real and current.
  if not exists (
    select 1 from public.customers
    where id = p_customer_id and assigned_worker_id = v_worker_id and status = 'active'
  ) then
    raise exception 'Customer % is not currently assigned to this worker', p_customer_id;
  end if;

  if not exists (select 1 from public.milk_types where id = p_milk_type_id and is_active) then
    raise exception 'Milk type % is not a valid, active milk type', p_milk_type_id;
  end if;

  if p_event_type = 'created' then
    select default_daily_quantity_ml into v_scheduled_quantity_ml
    from public.customers where id = p_customer_id;

    v_price_paise := public.resolve_milk_price_paise(p_customer_id, p_milk_type_id, p_delivery_date);

    begin
      insert into public.deliveries (
        id, customer_id, worker_id, milk_type_id, delivery_date,
        scheduled_quantity_ml, delivered_quantity_ml, status, reason,
        price_paise_snapshot, device_recorded_at, version, created_by
      ) values (
        p_delivery_id, p_customer_id, v_worker_id, p_milk_type_id, p_delivery_date,
        v_scheduled_quantity_ml, p_delivered_quantity_ml, p_status, p_reason,
        v_price_paise, p_device_recorded_at, 1, v_worker_id
      )
      returning * into v_delivery;

      v_applied := true;
      v_outcome := 'applied';
    exception when unique_violation then
      -- A different delivery id already claimed this customer+date — two
      -- local "created" events for the same day. Preserve both, don't merge.
      select * into v_delivery from public.deliveries
        where customer_id = p_customer_id and delivery_date = p_delivery_date;
      update public.deliveries set has_conflict = true where id = v_delivery.id;
      v_conflict := true;
      v_outcome := 'conflict_duplicate_creation';
    end;
  else
    select * into v_delivery from public.deliveries where id = p_delivery_id for update;

    if v_delivery.id is null then
      raise exception 'Delivery % not found for correction', p_delivery_id;
    end if;

    if v_delivery.version <> p_expected_version then
      update public.deliveries set has_conflict = true where id = p_delivery_id;
      v_conflict := true;
      v_outcome := 'conflict_stale_version';
    else
      update public.deliveries set
        delivered_quantity_ml = p_delivered_quantity_ml,
        status = p_status,
        reason = p_reason,
        version = version + 1
      where id = p_delivery_id
      returning * into v_delivery;

      v_applied := true;
      v_outcome := 'applied';
    end if;
  end if;

  insert into public.delivery_events (
    id, delivery_id, customer_id, worker_id, event_type, payload,
    device_recorded_at, applied, conflict
  ) values (
    p_event_id, p_delivery_id, p_customer_id, v_worker_id, p_event_type,
    jsonb_build_object(
      'milk_type_id', p_milk_type_id,
      'delivery_date', p_delivery_date,
      'status', p_status,
      'delivered_quantity_ml', p_delivered_quantity_ml,
      'reason', p_reason,
      'expected_version', p_expected_version
    ),
    p_device_recorded_at, v_applied, v_conflict
  );

  insert into public.delivery_sync_receipts (event_id, delivery_id, outcome)
  values (p_event_id, p_delivery_id, v_outcome);

  -- Stage 5: never silently change an already-finalized bill — flag it instead.
  update public.monthly_bills
  set flagged_for_review = true,
      flagged_reason = coalesce(flagged_reason || '; ', '')
        || 'Delivery event received for ' || p_delivery_date || ' after this bill was finalized'
  where customer_id = p_customer_id
    and billing_month = date_trunc('month', p_delivery_date)::date
    and status in ('finalized', 'partially_paid', 'paid');

  return jsonb_build_object(
    'applied', v_applied,
    'duplicate', false,
    'conflict', v_conflict,
    'outcome', v_outcome,
    'delivery', to_jsonb(v_delivery)
  );
end;
$$;

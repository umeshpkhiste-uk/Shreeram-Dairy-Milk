-- A customer can take several products. The first stays in milk_type_id /
-- default_daily_quantity_ml, so older app versions keep working; the others are
-- in extra_products. Deliveries become unique per customer, day and product.

alter table public.customers
  add column extra_products jsonb not null default '[]';

comment on column public.customers.extra_products is
  'Products besides milk_type_id: [{"milk_type_id": uuid, "quantity_ml": integer}], in ml or grams like default_daily_quantity_ml.';

-- JSON carries no foreign key or check constraints, so this does their work.
create function public._check_extra_products()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(new.extra_products) is distinct from 'array' then
    raise exception 'extra_products must be a list';
  end if;

  if exists (
    select 1 from jsonb_array_elements(new.extra_products) e
    where not exists (
        select 1 from public.milk_types m where m.id = (e->>'milk_type_id')::uuid
      )
      or coalesce((e->>'quantity_ml')::integer, 0) <= 0
  ) then
    raise exception 'Each product needs a type and a quantity greater than zero';
  end if;

  if exists (
    select 1 from jsonb_array_elements(new.extra_products) e
    group by (e->>'milk_type_id')::uuid having count(*) > 1
  ) then
    raise exception 'Each product can be added only once';
  end if;

  -- An older app version can make an extra product the first one.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'milk_type_id', (e->>'milk_type_id')::uuid,
        'quantity_ml', (e->>'quantity_ml')::integer
      ) order by n
    ), '[]'
  ) into new.extra_products
  from jsonb_array_elements(new.extra_products) with ordinality x(e, n)
  where (e->>'milk_type_id')::uuid <> new.milk_type_id;

  return new;
end;
$$;

revoke all on function public._check_extra_products() from public, anon, authenticated;

create trigger check_extra_products
  before insert or update of milk_type_id, extra_products on public.customers
  for each row execute function public._check_extra_products();

create function public._customer_products(p_customer_id uuid)
returns table (milk_type_id uuid, quantity_ml integer)
language sql
security definer
set search_path = public
stable
as $$
  select c.milk_type_id, c.default_daily_quantity_ml
  from public.customers c where c.id = p_customer_id
  union all
  select (e->>'milk_type_id')::uuid, (e->>'quantity_ml')::integer
  from public.customers c, jsonb_array_elements(c.extra_products) e
  where c.id = p_customer_id;
$$;

revoke all on function public._customer_products(uuid) from public, anon, authenticated;

drop index public.deliveries_customer_date_idx;
create unique index deliveries_customer_date_product_idx
  on public.deliveries (customer_id, delivery_date, milk_type_id);

alter table public.business_settings
  alter column business_name set default 'Shreeram Doodh Dairy & Sweets';

-- Below: the existing functions, changed only where they assumed one product
-- per customer and day.

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
    -- A product taken off the customer since the phone recorded it has no
    -- scheduled quantity any more: use what was delivered.
    select coalesce(
      (select p.quantity_ml from public._customer_products(p_customer_id) p
       where p.milk_type_id = p_milk_type_id),
      nullif(p_delivered_quantity_ml, 0),
      c.default_daily_quantity_ml
    ) into v_scheduled_quantity_ml
    from public.customers c where c.id = p_customer_id;

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
      -- A different delivery id already claimed this customer+date+product — two
      -- local "created" events for the same day. Preserve both, don't merge.
      select * into v_delivery from public.deliveries
        where customer_id = p_customer_id
          and delivery_date = p_delivery_date
          and milk_type_id = p_milk_type_id;
      update public.deliveries set has_conflict = true where id = v_delivery.id;
      v_conflict := true;
      v_outcome := 'conflict_duplicate_creation';
    end;
  else
    select * into v_delivery from public.deliveries where id = p_delivery_id for update;

    if v_delivery.id is null then
      raise exception 'Delivery % not found for correction', p_delivery_id;
    end if;
    -- An app version from before multiple products could correct the wrong one.
    if v_delivery.milk_type_id <> p_milk_type_id then
      raise exception 'Delivery % is for a different product', p_delivery_id;
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

create or replace function public.admin_resolve_delivery_conflict(
  p_delivery_id uuid,
  p_event_id uuid
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries;
  v_event public.delivery_events;
  v_status public.delivery_status;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can resolve a delivery conflict';
  end if;

  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if v_delivery.id is null or not v_delivery.has_conflict then
    raise exception 'This delivery has no conflict to resolve';
  end if;

  if p_event_id is null then
    update public.deliveries set has_conflict = false
    where id = p_delivery_id
    returning * into v_delivery;
    return v_delivery;
  end if;

  -- Matched on customer, day and product, not delivery_id: a duplicate creation
  -- carries its own device's id for the same day.
  select * into v_event from public.delivery_events
  where id = p_event_id
    and conflict
    and customer_id = v_delivery.customer_id
    and (payload->>'delivery_date')::date = v_delivery.delivery_date
    and (payload->>'milk_type_id')::uuid = v_delivery.milk_type_id;
  if v_event.id is null then
    raise exception 'That record does not belong to this conflict';
  end if;

  v_status := (v_event.payload->>'status')::public.delivery_status;
  update public.deliveries set
    status = v_status,
    delivered_quantity_ml = (v_event.payload->>'delivered_quantity_ml')::integer,
    -- Older app versions sent no reason for a missed delivery.
    reason = case
      when v_status = 'completed' then v_event.payload->>'reason'
      else coalesce(nullif(trim(v_event.payload->>'reason'), ''), 'Marked not delivered by worker')
    end,
    version = version + 1,
    has_conflict = false
  where id = p_delivery_id
  returning * into v_delivery;

  -- Same rule as submit_delivery_event: never silently change a finalized bill.
  update public.monthly_bills
  set flagged_for_review = true,
      flagged_reason = coalesce(flagged_reason || '; ', '')
        || 'Delivery conflict for ' || v_delivery.delivery_date || ' resolved after this bill was finalized'
  where customer_id = v_delivery.customer_id
    and billing_month = date_trunc('month', v_delivery.delivery_date)::date
    and status in ('finalized', 'partially_paid', 'paid');

  return v_delivery;
end;
$$;

-- Skips the whole day: every product of the customer.
create or replace function public.admin_mark_delivery_skipped(
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

  if exists (
    select 1 from public.deliveries
    where customer_id = p_customer_id and delivery_date = p_delivery_date
      and status in ('completed', 'partial')
  ) then
    raise exception 'This day already has a recorded delivery and cannot be marked skipped';
  end if;

  update public.deliveries set
    status = 'skipped',
    delivered_quantity_ml = 0,
    reason = p_reason,
    version = version + 1
  where customer_id = p_customer_id and delivery_date = p_delivery_date;

  insert into public.deliveries (
    id, customer_id, worker_id, milk_type_id, delivery_date,
    scheduled_quantity_ml, delivered_quantity_ml, status, reason,
    price_paise_snapshot, device_recorded_at, version, created_by
  )
  select
    gen_random_uuid(), p_customer_id, v_customer.assigned_worker_id, p.milk_type_id,
    p_delivery_date, p.quantity_ml, 0, 'skipped', p_reason,
    public.resolve_milk_price_paise(p_customer_id, p.milk_type_id, p_delivery_date),
    now(), 1, v_admin_id
  from public._customer_products(p_customer_id) p
  on conflict (customer_id, delivery_date, milk_type_id) do nothing;

  select * into v_delivery from public.deliveries
  where customer_id = p_customer_id and delivery_date = p_delivery_date
  order by milk_type_id = v_customer.milk_type_id desc
  limit 1;

  return v_delivery;
end;
$$;

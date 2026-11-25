-- 1. A change of products or daily quantity has a start date, so bills follow it
--    from that day; it can be in the past or the future.
-- 2. Old records from a worker's phone are accepted if the customer was theirs on
--    that day; what the server still refuses is listed for the admin.
-- 3. Editing an unpaid order keeps the prices and items already on it.

create table public.customer_products_history (
  customer_id uuid not null references public.customers (id) on delete cascade,
  effective_from date not null,
  milk_type_id uuid not null references public.milk_types (id),
  default_daily_quantity_ml integer not null check (default_daily_quantity_ml > 0),
  extra_products jsonb not null default '[]',
  set_at timestamptz not null default clock_timestamp(),
  primary key (customer_id, effective_from)
);

comment on table public.customer_products_history is
  'What a customer takes daily, from each date on. customers.milk_type_id/default_daily_quantity_ml/extra_products are today''s row. Written by set_customer_products and the customers trigger only.';

create trigger check_extra_products
  before insert or update on public.customer_products_history
  for each row execute function public._check_extra_products();

alter table public.customer_products_history enable row level security;

create policy "customer_products_history_select_admin_only"
  on public.customer_products_history for select
  to authenticated
  using (public.is_admin());

revoke all on public.customer_products_history from anon;
revoke insert, update, delete, truncate on public.customer_products_history from authenticated;

-- What the audit log knows about the customers so far: the first state, then
-- each change from its day on.
insert into public.customer_products_history
  (customer_id, effective_from, milk_type_id, default_daily_quantity_ml, extra_products, set_at)
select c.id, '2000-01-01', (s.j->>'milk_type_id')::uuid, (s.j->>'default_daily_quantity_ml')::integer,
  coalesce(s.j->'extra_products', '[]'), c.created_at
from public.customers c
cross join lateral (select public._row_on('customers', c.id, '2000-01-01', to_jsonb(c)) as j) s;

insert into public.customer_products_history
  (customer_id, effective_from, milk_type_id, default_daily_quantity_ml, extra_products, set_at)
select distinct on (entity_id, day) entity_id, day, (after_data->>'milk_type_id')::uuid,
  (after_data->>'default_daily_quantity_ml')::integer, coalesce(after_data->'extra_products', '[]'), created_at
from (
  select a.*, (a.created_at at time zone 'Asia/Kolkata')::date as day
  from public.audit_logs a join public.customers c on c.id = a.entity_id
  where a.entity_type = 'customers' and a.action = 'UPDATE'
    and (a.before_data->'milk_type_id', a.before_data->'default_daily_quantity_ml',
        coalesce(a.before_data->'extra_products', '[]'))
      is distinct from
      (a.after_data->'milk_type_id', a.after_data->'default_daily_quantity_ml',
        coalesce(a.after_data->'extra_products', '[]'))
) changes
order by entity_id, day, created_at desc;

create function public._customer_products_on(p_customer_id uuid, p_date date)
returns table (milk_type_id uuid, quantity_ml integer, n bigint, set_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  with h as (
    select * from public.customer_products_history h
    where h.customer_id = p_customer_id and h.effective_from <= p_date
    order by h.effective_from desc
    limit 1
  )
  select h.milk_type_id, h.default_daily_quantity_ml, 0::bigint, h.set_at from h
  union all
  select (e->>'milk_type_id')::uuid, (e->>'quantity_ml')::integer, x.n, h.set_at
  from h, jsonb_array_elements(h.extra_products) with ordinality x(e, n);
$$;

revoke all on function public._customer_products_on(uuid, date) from public, anon, authenticated;

-- A new customer, or a change made directly on customers, counts from today.
create function public.keep_products_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if tg_op = 'UPDATE' then
    if exists (
      select 1 from (
        select * from public.customer_products_history h
        where h.customer_id = new.id and h.effective_from <= v_today
        order by h.effective_from desc
        limit 1
      ) h
      where (h.milk_type_id, h.default_daily_quantity_ml, h.extra_products)
        = (new.milk_type_id, new.default_daily_quantity_ml, new.extra_products)
    ) then
      return new;
    end if;
    delete from public.customer_products_history
    where customer_id = new.id and effective_from >= v_today;
  end if;

  insert into public.customer_products_history
    (customer_id, effective_from, milk_type_id, default_daily_quantity_ml, extra_products)
  values (
    new.id, case when tg_op = 'INSERT' then '2000-01-01' else v_today end,
    new.milk_type_id, new.default_daily_quantity_ml, new.extra_products
  );
  return new;
end;
$$;

revoke all on function public.keep_products_history() from public, anon, authenticated;

create trigger keep_products_history
  after insert or update of milk_type_id, default_daily_quantity_ml, extra_products
  on public.customers
  for each row execute function public.keep_products_history();

-- From p_effective_from on the customer takes these products; changes already
-- set for later days are replaced.
create function public.set_customer_products(
  p_customer_id uuid,
  p_effective_from date,
  p_milk_type_id uuid,
  p_quantity_ml integer,
  p_extra_products jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_effective_from is null or p_effective_from < '2000-01-02' or p_effective_from > v_today + 366 then
    raise exception 'Choose the date the change starts on';
  end if;
  perform 1 from public.customers where id = p_customer_id for no key update;
  if not found then
    raise exception 'Customer not found';
  end if;

  delete from public.customer_products_history
  where customer_id = p_customer_id and effective_from >= p_effective_from;
  insert into public.customer_products_history
    (customer_id, effective_from, milk_type_id, default_daily_quantity_ml, extra_products)
  values (p_customer_id, p_effective_from, p_milk_type_id, p_quantity_ml, p_extra_products);

  perform public._apply_products(p_customer_id);

  update public.monthly_bills b
  set flagged_for_review = true,
      flagged_reason = coalesce(b.flagged_reason || '; ', '')
        || 'The products or quantity from ' || p_effective_from || ' changed after this bill was generated'
  where b.customer_id = p_customer_id
    and b.status in ('finalized', 'partially_paid', 'paid')
    and (b.billing_month + interval '1 month')::date > p_effective_from
    and (b.finalized_at at time zone 'Asia/Kolkata')::date >= p_effective_from;
end;
$$;

revoke all on function public.set_customer_products(uuid, date, uuid, integer, jsonb) from public, anon;
grant execute on function public.set_customer_products(uuid, date, uuid, integer, jsonb) to authenticated;

create function public._apply_products(p_customer_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.customers c
  set milk_type_id = h.milk_type_id,
      default_daily_quantity_ml = h.default_daily_quantity_ml,
      extra_products = h.extra_products
  from (
    select distinct on (customer_id) * from public.customer_products_history
    where (p_customer_id is null or customer_id = p_customer_id)
      and effective_from <= (now() at time zone 'Asia/Kolkata')::date
    order by customer_id, effective_from desc
  ) h
  where c.id = h.customer_id
    and (c.milk_type_id, c.default_daily_quantity_ml, c.extra_products)
      is distinct from (h.milk_type_id, h.default_daily_quantity_ml, h.extra_products);
$$;

revoke all on function public._apply_products(uuid) from public, anon, authenticated;

-- Puts changes that start today on the customers. Bills don't need it; the
-- phones' and admin's lists do, so both call it before they load.
create function public.apply_due_product_changes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_active) then
    raise exception 'Authentication required';
  end if;
  perform public._apply_products(null);
end;
$$;

revoke all on function public.apply_due_product_changes() from public, anon;
grant execute on function public.apply_due_product_changes() to authenticated;

-- Records a phone could not save, so the admin sees them; a later success
-- removes its row.
create table public.sync_failures (
  event_id uuid primary key,
  worker_id uuid not null references public.workers (id),
  payload jsonb not null,
  error text not null,
  reported_at timestamptz not null default now(),
  dismissed_at timestamptz
);

alter table public.sync_failures enable row level security;

create policy "sync_failures_select_admin_only"
  on public.sync_failures for select
  to authenticated
  using (public.is_admin());

revoke all on public.sync_failures from anon;
revoke insert, update, delete, truncate on public.sync_failures from authenticated;

create function public.report_sync_failure(p_event_id uuid, p_payload jsonb, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'worker' and is_active
  ) then
    raise exception 'Only an active worker can report a failed record';
  end if;
  if length(p_payload::text) > 4000
    or (select count(*) from public.sync_failures where worker_id = auth.uid()) >= 500
  then
    return;
  end if;

  insert into public.sync_failures (event_id, worker_id, payload, error)
  values (p_event_id, auth.uid(), p_payload, left(p_error, 500))
  on conflict (event_id) do update
  set error = excluded.error, reported_at = now()
  where sync_failures.worker_id = auth.uid();
end;
$$;

revoke all on function public.report_sync_failure(uuid, jsonb, text) from public, anon;
grant execute on function public.report_sync_failure(uuid, jsonb, text) to authenticated;

create function public.dismiss_sync_failure(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  update public.sync_failures set dismissed_at = now() where event_id = p_event_id;
end;
$$;

revoke all on function public.dismiss_sync_failure(uuid) from public, anon;
grant execute on function public.dismiss_sync_failure(uuid) to authenticated;

create or replace function public._charges(p_customer_id uuid, p_month date)
returns table (
  delivery_id uuid, day date, milk_type_id uuid,
  quantity_ml integer, price_paise bigint, amount_paise bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with bill as (
    select c.id as customer_id, p_month as first_day,
      least(
        (p_month + interval '1 month')::date - 1,
        (now() at time zone 'Asia/Kolkata')::date
      ) as last_day,
      c.delivery_start_date, to_jsonb(c) as customer_now
    from public.customers c
    where c.id = p_customer_id
  ), recorded as (
    select d.* from public.deliveries d
    join bill on d.customer_id = bill.customer_id
      and d.delivery_date between bill.first_day and bill.last_day
  ), days as (
    select g::date as day, bill.customer_id,
      public._row_on('customers', bill.customer_id, g::date, bill.customer_now) as customer
    from bill, generate_series(
      greatest(bill.first_day, bill.delivery_start_date)::timestamp, bill.last_day, '1 day'
    ) g
    -- Customer informed covers the whole day, also a product added since.
    where not exists (
      select 1 from recorded r where r.delivery_date = g::date and r.status = 'skipped'
    )
  ), expected as (
    select days.day, days.customer_id, p.milk_type_id, p.quantity_ml, p.n
    from days
    cross join lateral public._customer_products_on(days.customer_id, days.day) p
    where customer->>'status' = 'active'
  ), unrecorded as (
    select e.*, row_number() over (partition by e.day order by e.n) as rn
    from expected e
    where not exists (
      select 1 from recorded r
      where r.delivery_date = e.day and r.milk_type_id = e.milk_type_id
    )
  ), charges as (
    select r.id as delivery_id, r.delivery_date as day, r.milk_type_id,
      -- A delivered day follows a quantity change that was entered after it was
      -- recorded; otherwise what the worker recorded stands.
      coalesce((
        select p.quantity_ml
        from public._customer_products_on(r.customer_id, r.delivery_date) p
        where p.milk_type_id = r.milk_type_id
          and r.status = 'completed'
          and p.set_at > r.device_recorded_at
      ), r.delivered_quantity_ml) as quantity_ml,
      -- A customer rate set later with an earlier start date counts for recorded
      -- days too; without one, the price the delivery was recorded with stays.
      coalesce((
        select cr.price_paise from public.customer_milk_rates cr
        where cr.customer_id = r.customer_id
          and cr.milk_type_id = r.milk_type_id
          and cr.effective_from <= r.delivery_date
          and (cr.effective_to is null or cr.effective_to > r.delivery_date)
        order by cr.effective_from desc
        limit 1
      ), r.price_paise_snapshot) as price_paise
    from recorded r
    where r.status in ('completed', 'partial')
    union all
    select null, u.day, u.milk_type_id, u.quantity_ml,
      public.resolve_milk_price_paise(u.customer_id, u.milk_type_id, u.day)
    from unrecorded u
    -- As in dayProducts (packages/shared): a record of a product since taken off
    -- the customer stands in for one unrecorded product.
    where u.rn > (
      select count(*) from recorded r
      where r.delivery_date = u.day and not exists (
        select 1 from expected e where e.day = u.day and e.milk_type_id = r.milk_type_id
      )
    )
  )
  select delivery_id, day, milk_type_id, quantity_ml, price_paise,
    round((price_paise::numeric * quantity_ml::numeric) / 1000)::bigint
  from charges;
$$;

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

  -- Never trust a worker's device to name an arbitrary customer: the assignment
  -- must be real, now or on the delivery date (as that day began or ended), so a
  -- phone that was offline can still send its old records.
  if not exists (
    select 1 from public.customers c
    cross join lateral (
      values (to_jsonb(c)),
        (public._row_on('customers', c.id, p_delivery_date, to_jsonb(c))),
        (public._row_on('customers', c.id, p_delivery_date - 1, to_jsonb(c)))
    ) as s(customer)
    where c.id = p_customer_id
      and s.customer->>'assigned_worker_id' = v_worker_id::text
      and s.customer->>'status' = 'active'
  ) then
    raise exception 'This customer was not assigned to this worker on %', p_delivery_date;
  end if;

  if not exists (select 1 from public.milk_types where id = p_milk_type_id and is_active)
    and not exists (
      select 1 from public._customer_products_on(p_customer_id, p_delivery_date) p
      where p.milk_type_id = p_milk_type_id
    )
  then
    raise exception 'Milk type % is not a valid, active milk type', p_milk_type_id;
  end if;

  if p_event_type = 'created' then
    -- A product taken off the customer since the phone recorded it has no
    -- scheduled quantity any more: use what was delivered.
    select coalesce(
      (select p.quantity_ml from public._customer_products_on(p_customer_id, p_delivery_date) p
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

  delete from public.sync_failures where event_id = p_event_id;

  return jsonb_build_object(
    'applied', v_applied,
    'duplicate', false,
    'conflict', v_conflict,
    'outcome', v_outcome,
    'delivery', to_jsonb(v_delivery)
  );
end;
$$;

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
  from public._customer_products_on(p_customer_id, p_delivery_date) p
  on conflict (customer_id, delivery_date, milk_type_id) do nothing;

  select * into v_delivery from public.deliveries
  where customer_id = p_customer_id and delivery_date = p_delivery_date
  order by milk_type_id = v_customer.milk_type_id desc
  limit 1;

  return v_delivery;
end;
$$;

drop function public._customer_products(uuid);

create or replace function public.set_customer_rate(
  p_customer_id uuid,
  p_milk_type_id uuid,
  p_price_paise bigint,
  p_effective_from date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open public.customer_milk_rates;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_price_paise is null or p_price_paise < 0 then
    raise exception 'Enter a valid price';
  end if;
  perform 1 from public.customers where id = p_customer_id for no key update;

  select * into v_open from public.customer_milk_rates
  where customer_id = p_customer_id and milk_type_id = p_milk_type_id and effective_to is null;
  if v_open.effective_from > p_effective_from
    and v_open.effective_from > (now() at time zone 'Asia/Kolkata')::date
  then
    -- A rate that has not started yet is replaced.
    delete from public.customer_milk_rates where id = v_open.id;
    select * into v_open from public.customer_milk_rates
    where customer_id = p_customer_id and milk_type_id = p_milk_type_id
      and effective_to = v_open.effective_from
    order by effective_from desc
    limit 1;
  end if;
  if v_open.effective_from > p_effective_from then
    raise exception 'The present rate starts on %. Choose that date or a later one.',
      to_char(v_open.effective_from, 'FMDD Mon YYYY');
  end if;

  update public.customer_milk_rates set effective_to = p_effective_from where id = v_open.id;
  insert into public.customer_milk_rates (customer_id, milk_type_id, price_paise, effective_from)
  values (p_customer_id, p_milk_type_id, p_price_paise, p_effective_from);

  update public.monthly_bills b
  set flagged_for_review = true,
      flagged_reason = coalesce(b.flagged_reason || '; ', '')
        || 'The rate from ' || p_effective_from || ' changed after this bill was generated'
  where b.customer_id = p_customer_id
    and b.status in ('finalized', 'partially_paid', 'paid')
    and exists (
      select 1 from public.bill_items i
      where i.bill_id = b.id and i.milk_type_id = p_milk_type_id
        and i.delivery_date >= p_effective_from and i.price_paise <> p_price_paise
    );
end;
$$;

create or replace function public.update_order_items(
  p_order_id uuid,
  p_items jsonb -- [{ "productId": uuid, "quantity": integer }, ...]
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_product public.products;
  v_old jsonb;
  v_price bigint;
  v_quantity integer;
  v_amount_paise bigint;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can update an order';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Unknown order';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'This order is already paid, so its items cannot be changed';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one item';
  end if;

  -- What is already on the order keeps the price it was ordered at, also when the
  -- product's price changed or it was turned off since.
  select coalesce(jsonb_object_agg(product_id, price_paise), '{}') into v_old
  from public.order_items where order_id = p_order_id;

  delete from public.order_items where order_id = p_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Each item needs a positive quantity';
    end if;

    select * into v_product from public.products
      where id = (v_item ->> 'productId')::uuid
        and (is_active or v_old ? id::text);
    if v_product.id is null then
      raise exception 'Unknown or inactive product';
    end if;

    v_price := coalesce((v_old ->> v_product.id::text)::bigint, v_product.price_paise);
    v_amount_paise := round(v_price * v_quantity / 1000.0);

    insert into public.order_items (order_id, product_id, quantity, price_paise, amount_paise)
    values (p_order_id, v_product.id, v_quantity, v_price, v_amount_paise);
  end loop;

  return v_order;
end;
$$;

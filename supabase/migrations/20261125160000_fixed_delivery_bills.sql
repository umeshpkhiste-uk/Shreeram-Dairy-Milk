-- Owner decision: a bill charges the customer's fixed daily products for every
-- day up to today, unless that day is recorded otherwise (missed, customer
-- informed, or a different quantity). generate_bill replaces recalculate +
-- finalize, and can be run again to bring the same bill up to date.

-- A fixed day has no delivery record.
alter table public.bill_items alter column delivery_id drop not null;
create unique index bill_items_bill_day_product_idx
  on public.bill_items (bill_id, delivery_date, milk_type_id);

-- Unrecorded days are charged by what held on that day, so a later change of
-- quantity, products, status or default price must not reach back.
create trigger audit_milk_types
  after update on public.milk_types
  for each row execute function public.audit_row_change();

-- The row as it was at the end of p_date: what the first change after that day
-- replaced, or else the row as it is now.
create function public._row_on(p_table text, p_id uuid, p_date date, p_now jsonb)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select a.before_data from public.audit_logs a
      where a.entity_type = p_table and a.entity_id = p_id and a.action = 'UPDATE'
        and a.created_at >= (p_date + 1)::timestamp at time zone 'Asia/Kolkata'
      order by a.created_at
      limit 1
    ),
    p_now
  );
$$;

revoke all on function public._row_on(text, uuid, date, jsonb) from public, anon, authenticated;

create or replace function public.resolve_milk_price_paise(
  p_customer_id uuid,
  p_milk_type_id uuid,
  p_as_of date
)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select price_paise
      from public.customer_milk_rates
      where customer_id = p_customer_id
        and milk_type_id = p_milk_type_id
        and effective_from <= p_as_of
        and (effective_to is null or effective_to > p_as_of)
      order by effective_from desc
      limit 1
    ),
    (
      select (public._row_on('milk_types', m.id, p_as_of, to_jsonb(m))->>'default_price_paise')::bigint
      from public.milk_types m where m.id = p_milk_type_id
    )
  );
$$;

-- Adds the billable days a bill does not have yet; days already on it stay as
-- they are.
create function public._add_bill_items(p_bill_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  with bill as (
    select b.id, b.customer_id, b.billing_month as first_day,
      least(
        (b.billing_month + interval '1 month')::date - 1,
        (now() at time zone 'Asia/Kolkata')::date
      ) as last_day,
      c.delivery_start_date, to_jsonb(c) as customer_now
    from public.monthly_bills b
    join public.customers c on c.id = b.customer_id
    where b.id = p_bill_id
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
    cross join lateral (
      select (customer->>'milk_type_id')::uuid as milk_type_id,
        (customer->>'default_daily_quantity_ml')::integer as quantity_ml, 0::bigint as n
      union all
      select (e->>'milk_type_id')::uuid, (e->>'quantity_ml')::integer, n
      from jsonb_array_elements(coalesce(customer->'extra_products', '[]')) with ordinality x(e, n)
    ) p
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
      r.delivered_quantity_ml as quantity_ml, r.price_paise_snapshot as price_paise
    from recorded r
    where r.status in ('completed', 'partial')
      and not exists (
        select 1 from public.bill_items bi where bi.delivery_id = r.id and not bi.voided
      )
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
  insert into public.bill_items (
    bill_id, delivery_id, delivery_date, milk_type_id, quantity_ml, price_paise, amount_paise
  )
  select p_bill_id, delivery_id, day, milk_type_id, quantity_ml, price_paise,
    round((price_paise::numeric * quantity_ml::numeric) / 1000)::bigint
  from charges
  on conflict (bill_id, delivery_date, milk_type_id) do nothing;
$$;

revoke all on function public._add_bill_items(uuid) from public, anon, authenticated;

create or replace function public._populate_bill_items(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bill_items where bill_id = p_bill_id;
  perform public._add_bill_items(p_bill_id);
  perform public._recompute_bill_financials(p_bill_id);
end;
$$;

-- Brings a bill up to today. Earlier bills are completed first, because one
-- generated mid-month still misses the days after it: a draft is redone, a
-- generated bill only gets its missing days.
create function public._refresh_bill(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.monthly_bills;
  v_earlier public.monthly_bills;
begin
  select * into v_bill from public.monthly_bills where id = p_bill_id;

  for v_earlier in
    select * from public.monthly_bills
    where customer_id = v_bill.customer_id
      and billing_month < v_bill.billing_month
      and status <> 'voided'
    order by billing_month
  loop
    if v_earlier.status = 'draft' then
      perform public._populate_bill_items(v_earlier.id);
    else
      perform public._add_bill_items(v_earlier.id);
      perform public._recompute_bill_financials(v_earlier.id);
    end if;
  end loop;

  update public.monthly_bills
  set previous_outstanding_balance_paise = (
    select coalesce(sum(b.subtotal_paise + b.adjustments_total_paise), 0) - coalesce(sum((
      select coalesce(sum(p.amount_paise), 0) from public.payments p
      where p.bill_id = b.id and p.voided_at is null
    )), 0)
    from public.monthly_bills b
    where b.customer_id = v_bill.customer_id
      and b.billing_month < v_bill.billing_month
      and b.status <> 'voided'
  )
  where id = p_bill_id;

  perform public._populate_bill_items(p_bill_id);
end;
$$;

revoke all on function public._refresh_bill(uuid) from public, anon, authenticated;

create or replace function public.create_draft_bill(p_customer_id uuid, p_billing_month date)
returns public.monthly_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_billing_month)::date;
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

  insert into public.monthly_bills (customer_id, billing_month)
  values (p_customer_id, v_month)
  returning * into v_bill;

  perform public._refresh_bill(v_bill.id);

  select * into v_bill from public.monthly_bills where id = v_bill.id;
  return v_bill;
end;
$$;

-- A bill whose balance a later generated bill already includes keeps its numbers.
create function public.generate_bill(p_bill_id uuid)
returns public.monthly_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.monthly_bills;
  v_included boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_bill from public.monthly_bills where id = p_bill_id for update;
  if v_bill.id is null then
    raise exception 'Bill not found';
  end if;
  if v_bill.status = 'voided' then
    raise exception 'A voided bill cannot be generated';
  end if;

  v_included := exists (
    select 1 from public.monthly_bills
    where customer_id = v_bill.customer_id
      and billing_month > v_bill.billing_month
      and status not in ('draft', 'voided')
  );
  if v_included and v_bill.status <> 'draft' then
    return v_bill;
  end if;

  if not v_included then
    perform public._refresh_bill(p_bill_id);
  end if;

  update public.monthly_bills
  set status = case when status = 'draft' then 'finalized' else status end,
      finalized_at = now(),
      finalized_by = auth.uid(),
      flagged_for_review = false,
      flagged_reason = null
  where id = p_bill_id;

  perform public._recompute_bill_status(p_bill_id);

  select * into v_bill from public.monthly_bills where id = p_bill_id;
  return v_bill;
end;
$$;

revoke all on function public.generate_bill(uuid) from public, anon;
grant execute on function public.generate_bill(uuid) to authenticated;

-- A bill takes in earlier balances each time it is generated, not only when
-- it is created.
create or replace function public._assert_balance_not_carried(p_bill_id uuid)
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
    and coalesce(l.finalized_at, l.created_at) > b.created_at
    and l.status <> 'voided'
  where b.id = p_bill_id
    and b.subtotal_paise + b.adjustments_total_paise <> (
      select coalesce(sum(p.amount_paise), 0)
      from public.payments p
      where p.bill_id = b.id
        and p.created_at < coalesce(l.finalized_at, l.created_at)
        and (p.voided_at is null or p.voided_at > coalesce(l.finalized_at, l.created_at))
    )
  order by l.billing_month desc
  limit 1;

  if v_later.id is not null then
    raise exception 'Bill % (%) already includes this bill''s balance. Cancel or void that bill first.',
      v_later.bill_number, to_char(v_later.billing_month, 'FMMonth YYYY');
  end if;
end;
$$;

-- Everything on one bill, in the shape of BillPdfData (packages/shared). Anyone
-- holding a generated bill's id can read that bill: the customer's link has it.
create function public.get_bill_document(p_bill_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with bill as (
    select b.*, least(
      (b.billing_month + interval '1 month')::date - 1,
      greatest(
        (coalesce(b.finalized_at, now()) at time zone 'Asia/Kolkata')::date,
        -- Days added when a later bill was generated.
        (select max(i.delivery_date) from public.bill_items i where i.bill_id = b.id)
      )
    ) as billed_through
    from public.monthly_bills b
    where b.id = p_bill_id
      and (b.status not in ('draft', 'voided') or public.is_admin())
  )
  select jsonb_build_object(
    'business', (
      select jsonb_build_object(
        'businessName', s.business_name, 'contactPhone', s.contact_phone,
        'contactEmail', s.contact_email, 'address', s.address
      ) from public.business_settings s
    ),
    'customer', jsonb_build_object(
      'fullName', c.full_name, 'address', c.address,
      'mobileNumber', c.mobile_number, 'accountReference', c.account_reference
    ),
    'bill', jsonb_build_object(
      'billNumber', bill.bill_number,
      'billingMonth', bill.billing_month,
      'billedThrough', bill.billed_through,
      'status', bill.status,
      'previousOutstandingBalancePaise', bill.previous_outstanding_balance_paise,
      'subtotalPaise', bill.subtotal_paise,
      'adjustmentsTotalPaise', bill.adjustments_total_paise,
      'totalPayablePaise', bill.total_payable_paise
    ),
    'noDeliveryDays', (
      select count(distinct d.delivery_date) from public.deliveries d
      where d.customer_id = bill.customer_id
        and d.delivery_date between bill.billing_month and bill.billed_through
        and d.status = 'skipped'
        and not exists (
          select 1 from public.bill_items i
          where i.bill_id = bill.id and i.delivery_date = d.delivery_date
        )
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'deliveryDate', i.delivery_date, 'milkTypeName', m.name, 'unit', m.unit,
        'quantityMl', i.quantity_ml, 'pricePaise', i.price_paise, 'amountPaise', i.amount_paise
      ) order by i.delivery_date, m.name)
      from public.bill_items i join public.milk_types m on m.id = i.milk_type_id
      where i.bill_id = bill.id
    ), '[]'),
    'adjustments', coalesce((
      select jsonb_agg(jsonb_build_object('reason', a.reason, 'amountPaise', a.amount_paise)
        order by a.created_at)
      from public.bill_adjustments a where a.bill_id = bill.id
    ), '[]'),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'paymentDate', p.payment_date, 'amountPaise', p.amount_paise, 'method', p.method,
        'transactionReference', p.transaction_reference
      ) order by p.payment_date)
      from public.payments p where p.bill_id = bill.id and p.voided_at is null
    ), '[]')
  )
  from bill join public.customers c on c.id = bill.customer_id;
$$;

revoke all on function public.get_bill_document(uuid) from public;
grant execute on function public.get_bill_document(uuid) to anon, authenticated;

-- Flags a generated bill only when a record changes what it charged for that
-- day; confirming the fixed quantity, or a day after the bill, is normal. This
-- replaces the flagging inside the two functions below.
create function public.flag_changed_bill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.monthly_bills b
  set flagged_for_review = true,
      flagged_reason = coalesce(b.flagged_reason || '; ', '')
        || 'Delivery record for ' || new.delivery_date || ' changed after this bill was generated'
  where b.customer_id = new.customer_id
    and b.billing_month = date_trunc('month', new.delivery_date)::date
    and b.status in ('finalized', 'partially_paid', 'paid')
    and coalesce(
      (
        select i.quantity_ml from public.bill_items i
        where i.bill_id = b.id
          and i.delivery_date = new.delivery_date
          and i.milk_type_id = new.milk_type_id
      ),
      case when new.delivery_date <= (b.finalized_at at time zone 'Asia/Kolkata')::date then 0 end
    ) <> case
      when new.status in ('completed', 'partial') then new.delivered_quantity_ml else 0
    end;
  return new;
end;
$$;

revoke all on function public.flag_changed_bill() from public, anon, authenticated;

create trigger flag_changed_bill
  after insert or update of status, delivered_quantity_ml on public.deliveries
  for each row execute function public.flag_changed_bill();

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

  return v_delivery;
end;
$$;

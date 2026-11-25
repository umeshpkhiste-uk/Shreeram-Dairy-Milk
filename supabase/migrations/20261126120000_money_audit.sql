-- Money audit, 2026-11-26. The previous balance of every bill always equals the
-- earlier bills' charges less their payments, whatever changes and in whatever
-- order; it used to be taken only when a bill was generated.

create or replace function public._recompute_customer_bill_statuses(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- One change at a time per customer, so none works from an old balance.
  perform 1 from public.customers where id = p_customer_id for no key update;

  with bills as (
    select b.id, b.billing_month,
      b.subtotal_paise + b.adjustments_total_paise - (
        select coalesce(sum(p.amount_paise), 0)
        from public.payments p where p.bill_id = b.id and p.voided_at is null
      ) as own_balance
    from public.monthly_bills b
    where b.customer_id = p_customer_id and b.status <> 'voided'
  ), earlier as (
    select id, coalesce(sum(own_balance) over (
      order by billing_month rows between unbounded preceding and 1 preceding
    ), 0) as balance
    from bills
  )
  update public.monthly_bills b
  set previous_outstanding_balance_paise = e.balance,
      total_payable_paise = e.balance + b.subtotal_paise + b.adjustments_total_paise
  from earlier e
  where b.id = e.id and (
    b.previous_outstanding_balance_paise <> e.balance
    or b.total_payable_paise <> e.balance + b.subtotal_paise + b.adjustments_total_paise
  );

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

-- Always the customer first, then a bill: two people saving at once wait for
-- each other instead of failing.
create function public._lock_bill_customer(p_bill_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select 1 from public.customers
  where id = (select customer_id from public.monthly_bills where id = p_bill_id)
  for no key update;
$$;

revoke all on function public._lock_bill_customer(uuid) from public, anon, authenticated;

-- The bill's own lines, also used to find months nobody has billed.
create function public._charges(p_customer_id uuid, p_month date)
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
      r.delivered_quantity_ml as quantity_ml,
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

revoke all on function public._charges(uuid, date) from public, anon, authenticated;

-- Adds the billable days a bill does not have yet; days already on it stay as
-- they are.
create or replace function public._add_bill_items(p_bill_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.bill_items (
    bill_id, delivery_id, delivery_date, milk_type_id, quantity_ml, price_paise, amount_paise
  )
  select b.id, c.delivery_id, c.day, c.milk_type_id, c.quantity_ml, c.price_paise, c.amount_paise
  from public.monthly_bills b
  cross join lateral public._charges(b.customer_id, b.billing_month) c
  where b.id = p_bill_id
    and not exists (
      select 1 from public.bill_items bi where bi.delivery_id = c.delivery_id and not bi.voided
    )
  on conflict (bill_id, delivery_date, milk_type_id) do nothing;
$$;

-- Brings a bill up to today. Earlier bills are completed first, because one
-- generated mid-month still misses the days after it: a draft is redone, a
-- generated bill only gets its missing days.
create or replace function public._refresh_bill(p_bill_id uuid)
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
  perform 1 from public.customers where id = v_bill.customer_id for no key update;

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

  perform public._populate_bill_items(p_bill_id);
  perform public._recompute_customer_bill_statuses(v_bill.customer_id);
end;
$$;

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
  if v_month > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'This month has not started yet';
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

-- An older bill can be generated again too: the later ones follow its balance.
create or replace function public.generate_bill(p_bill_id uuid)
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

  perform public._lock_bill_customer(p_bill_id);
  select * into v_bill from public.monthly_bills where id = p_bill_id for update;
  if v_bill.id is null then
    raise exception 'Bill not found';
  end if;
  if v_bill.status = 'voided' then
    raise exception 'A voided bill cannot be generated';
  end if;

  perform public._refresh_bill(p_bill_id);

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

-- Later drafts follow by themselves; a later generated bill may already be with
-- the customer.
create or replace function public._assert_balance_not_carried(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_later public.monthly_bills;
begin
  select l.* into v_later
  from public.monthly_bills b
  join public.monthly_bills l
    on l.customer_id = b.customer_id
    and l.billing_month > b.billing_month
    and l.status not in ('draft', 'voided')
  where b.id = p_bill_id
    and b.subtotal_paise + b.adjustments_total_paise <> (
      select coalesce(sum(p.amount_paise), 0)
      from public.payments p
      where p.bill_id = b.id and p.voided_at is null
    )
  order by l.billing_month desc
  limit 1;

  if v_later.id is not null then
    raise exception 'Bill % (%) already includes this bill''s balance, so this bill cannot be removed.',
      v_later.bill_number, to_char(v_later.billing_month, 'FMMonth YYYY');
  end if;
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
  -- A voided bill's payments would no longer count anywhere.
  if exists (select 1 from public.payments where bill_id = p_bill_id and voided_at is null) then
    raise exception 'Undo the payments on this bill first';
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

create or replace function public.record_payment(
  p_payment_id uuid,
  p_bill_id uuid,
  p_amount_paise bigint,
  p_method public.payment_method,
  p_method_detail text,
  p_transaction_reference text,
  p_payment_date date,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.payments;
  v_customer_id uuid;
  v_status public.bill_status;
  v_bill public.monthly_bills;
  v_other public.monthly_bills;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  -- Idempotent on payment id: a retried call answers from the existing row, never
  -- reprocessed — same pattern as submit_delivery_event in Stage 3.
  select * into v_existing from public.payments where id = p_payment_id;
  if v_existing.id is not null then
    select * into v_bill from public.monthly_bills where id = v_existing.bill_id;
    return jsonb_build_object('duplicate', true, 'bill', to_jsonb(v_bill));
  end if;

  perform public._lock_bill_customer(p_bill_id);
  select customer_id, status into v_customer_id, v_status
  from public.monthly_bills where id = p_bill_id for update;
  if v_customer_id is null then
    raise exception 'Bill not found';
  end if;
  if v_status in ('draft', 'voided') then
    raise exception 'Cannot record a payment against a % bill', v_status;
  end if;

  if p_payment_date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'The payment date cannot be in the future';
  end if;

  select b.* into v_other
  from public.payments p join public.monthly_bills b on b.id = p.bill_id
  where p.customer_id = v_customer_id
    and p.bill_id <> p_bill_id
    and p.transaction_reference = p_transaction_reference
    and p.voided_at is null
  limit 1;
  if v_other.id is not null then
    raise exception 'This transaction number is already recorded on bill %', v_other.bill_number;
  end if;

  insert into public.payments (
    id, bill_id, customer_id, amount_paise, method, method_detail,
    transaction_reference, payment_date, notes, recorded_by
  ) values (
    p_payment_id, p_bill_id, v_customer_id, p_amount_paise, p_method, p_method_detail,
    p_transaction_reference, p_payment_date, p_notes, auth.uid()
  );

  perform public._recompute_bill_status(p_bill_id);

  select * into v_bill from public.monthly_bills where id = p_bill_id;
  return jsonb_build_object('duplicate', false, 'bill', to_jsonb(v_bill));
end;
$$;

create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns public.monthly_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill_id uuid;
  v_bill public.monthly_bills;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to void a payment';
  end if;

  perform public._lock_bill_customer(bill_id) from public.payments where id = p_payment_id;
  select bill_id into v_bill_id from public.payments
  where id = p_payment_id and voided_at is null for update;
  if v_bill_id is null then
    raise exception 'This payment is not there or is already undone';
  end if;

  update public.payments
  set voided_at = now(), void_reason = p_reason
  where id = p_payment_id;

  perform public._recompute_bill_status(v_bill_id);

  select * into v_bill from public.monthly_bills where id = v_bill_id;
  return v_bill;
end;
$$;

create or replace function public.get_bill_document(p_bill_id uuid)
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
        'contactEmail', s.contact_email, 'address', s.address, 'upiId', s.upi_id
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
    ), '[]'),
    -- The newest generated bill after this one; it carries this one's balance.
    'includedIn', (
      select l.bill_number from public.monthly_bills l
      where bill.status <> 'paid'
        and l.customer_id = bill.customer_id
        and l.billing_month > bill.billing_month
        and l.status not in ('draft', 'voided')
      order by l.billing_month desc
      limit 1
    ),
    'paymentClaimed', exists (
      select 1 from public.payment_claims pc where pc.bill_id = bill.id and pc.status = 'pending'
    )
  )
  from bill join public.customers c on c.id = bill.customer_id;
$$;

-- Closing the old rate and opening the new one were two separate saves; failing
-- in between left the customer on the default price.
create function public.set_customer_rate(
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

revoke all on function public.set_customer_rate(uuid, uuid, bigint, date) from public, anon;
grant execute on function public.set_customer_rate(uuid, uuid, bigint, date) to authenticated;

-- Compares the whole day: a record of one product can stand in for another, and
-- "customer informed" clears them all.
create or replace function public.flag_changed_bill()
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
    and (
      new.delivery_date <= (b.finalized_at at time zone 'Asia/Kolkata')::date
      or exists (
        select 1 from public.bill_items i
        where i.bill_id = b.id and i.delivery_date = new.delivery_date
      )
    )
    and (
      select jsonb_object_agg(i.milk_type_id, array[i.quantity_ml, i.price_paise])
      from public.bill_items i
      where i.bill_id = b.id and i.delivery_date = new.delivery_date and i.quantity_ml > 0
    ) is distinct from (
      select jsonb_object_agg(c.milk_type_id, array[c.quantity_ml, c.price_paise])
      from public._charges(b.customer_id, b.billing_month) c
      where c.day = new.delivery_date and c.quantity_ml > 0
    );
  return new;
end;
$$;

-- A new start date, or a change of products or status today, can make a
-- generated bill wrong.
create function public.flag_bills_on_customer_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  update public.monthly_bills b
  set flagged_for_review = true,
      flagged_reason = coalesce(b.flagged_reason || '; ', '')
        || 'The customer''s details changed after this bill was generated'
  where b.customer_id = new.id
    and b.status in ('finalized', 'partially_paid', 'paid')
    and (
      (
        new.delivery_start_date <> old.delivery_start_date
        and b.billing_month <= greatest(new.delivery_start_date, old.delivery_start_date)
        and (b.billing_month + interval '1 month')::date
          > least(new.delivery_start_date, old.delivery_start_date)
      )
      or (
        (new.milk_type_id, new.default_daily_quantity_ml, new.extra_products, new.status)
          is distinct from
        (old.milk_type_id, old.default_daily_quantity_ml, old.extra_products, old.status)
        and exists (
          select 1 from public.bill_items i where i.bill_id = b.id and i.delivery_date = v_today
        )
      )
    );
  return new;
end;
$$;

revoke all on function public.flag_bills_on_customer_change() from public, anon, authenticated;

create trigger flag_bills_on_customer_change
  after update of delivery_start_date, milk_type_id, default_daily_quantity_ml, extra_products, status
  on public.customers
  for each row execute function public.flag_bills_on_customer_change();

-- Finished months with something to charge and no bill. Their money is in no
-- later bill's balance.
create function public.list_unbilled_months(p_from date, p_customer_id uuid default null)
returns table (customer_id uuid, billing_month date, amount_paise bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select c.id, m::date, x.amount
  from public.customers c
  cross join lateral generate_series(
    date_trunc('month', greatest(p_from, least(c.delivery_start_date, (
      select min(d.delivery_date) from public.deliveries d where d.customer_id = c.id
    )))::timestamp),
    date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '1 month',
    '1 month'
  ) m
  cross join lateral (
    select sum(ch.amount_paise)::bigint as amount from public._charges(c.id, m::date) ch
  ) x
  where (p_customer_id is null or c.id = p_customer_id)
    and x.amount > 0
    and not exists (
      select 1 from public.monthly_bills b
      where b.customer_id = c.id and b.billing_month = m::date and b.status <> 'voided'
    );
end;
$$;

revoke all on function public.list_unbilled_months(date, uuid) from public, anon;
grant execute on function public.list_unbilled_months(date, uuid) to authenticated;

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

  delete from public.order_items where order_id = p_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Each item needs a positive quantity';
    end if;

    select * into v_product from public.products
      where id = (v_item ->> 'productId')::uuid and is_active;
    if v_product.id is null then
      raise exception 'Unknown or inactive product';
    end if;

    v_amount_paise := round(v_product.price_paise * v_quantity / 1000.0);

    insert into public.order_items (order_id, product_id, quantity, price_paise, amount_paise)
    values (p_order_id, v_product.id, v_quantity, v_product.price_paise, v_amount_paise);
  end loop;

  return v_order;
end;
$$;

-- Steps that generate_bill replaced.
drop function public.recalculate_draft_bill(uuid);
drop function public.finalize_bill(uuid);
drop function public.mark_bill_sent(uuid);

-- Bring the bills made so far in line.
select public._recompute_customer_bill_statuses(id) from public.customers;

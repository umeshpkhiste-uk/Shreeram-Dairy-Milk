-- "I have paid" on the customer's bill: a claim is only what the customer says.
-- It becomes a payment when an admin has checked the bank and confirms it.

create table public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.monthly_bills (id) on delete cascade,
  amount_paise bigint not null check (amount_paise between 1 and 100000000),
  transaction_reference text not null check (transaction_reference ~ '^[0-9]{12}$'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id)
);

comment on table public.payment_claims is
  'Written only through submit_payment_claim (anyone with the bill link) and resolve_payment_claim (admin).';

-- One waiting claim per bill; this also limits what a stranger with the link can send.
create unique index payment_claims_one_pending_idx
  on public.payment_claims (bill_id) where status = 'pending';

alter table public.payment_claims enable row level security;

create policy "payment_claims_select_admin_only"
  on public.payment_claims for select
  to authenticated
  using (public.is_admin());

revoke all on public.payment_claims from anon;
revoke insert, update, delete, truncate on public.payment_claims from authenticated;

create function public.submit_payment_claim(
  p_bill_id uuid,
  p_amount_paise bigint,
  p_transaction_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.monthly_bills
    where id = p_bill_id and status in ('finalized', 'partially_paid')
  ) then
    raise exception 'This bill has nothing to pay';
  end if;
  if p_transaction_reference !~ '^[0-9]{12}$' then
    raise exception 'Enter the 12-digit UPI transaction number';
  end if;
  if p_amount_paise not between 1 and 100000000 then
    raise exception 'Enter a valid amount';
  end if;

  insert into public.payment_claims (bill_id, amount_paise, transaction_reference)
  values (p_bill_id, p_amount_paise, p_transaction_reference)
  on conflict do nothing;
  if not found then
    raise exception 'We already have your payment details and will check them soon';
  end if;
end;
$$;

revoke all on function public.submit_payment_claim(uuid, bigint, text) from public;
grant execute on function public.submit_payment_claim(uuid, bigint, text) to anon, authenticated;

create function public.resolve_payment_claim(p_claim_id uuid, p_received boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.payment_claims;
  v_used_on public.monthly_bills;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_claim from public.payment_claims where id = p_claim_id for update;
  if v_claim.id is null or v_claim.status <> 'pending' then
    raise exception 'This payment has already been checked';
  end if;

  if p_received then
    select b.* into v_used_on
    from public.payments p join public.monthly_bills b on b.id = p.bill_id
    where p.transaction_reference = v_claim.transaction_reference and p.voided_at is null
    limit 1;

    if v_used_on.id is null then
      if (select status from public.monthly_bills where id = v_claim.bill_id) = 'paid' then
        raise exception 'This bill is already paid. Click Not received to remove this, or use Record payment if the customer paid again.';
      end if;
      -- The claim's id is the payment's id, so it can be recorded only once.
      perform public.record_payment(
        v_claim.id, v_claim.bill_id, v_claim.amount_paise, 'upi', null,
        v_claim.transaction_reference,
        (v_claim.created_at at time zone 'Asia/Kolkata')::date, 'Customer sent the transaction number'
      );
    elsif v_used_on.id <> v_claim.bill_id then
      raise exception 'This transaction number is already recorded on bill %', v_used_on.bill_number;
    end if; -- On this bill: the admin has already recorded it.
  end if;

  update public.payment_claims
  set status = case when p_received then 'confirmed' else 'dismissed' end,
      resolved_at = now(), resolved_by = auth.uid()
  where id = p_claim_id;
end;
$$;

revoke all on function public.resolve_payment_claim(uuid, boolean) from public, anon;
grant execute on function public.resolve_payment_claim(uuid, boolean) to authenticated;

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
    'paymentClaimed', exists (
      select 1 from public.payment_claims pc where pc.bill_id = bill.id and pc.status = 'pending'
    )
  )
  from bill join public.customers c on c.id = bill.customer_id;
$$;

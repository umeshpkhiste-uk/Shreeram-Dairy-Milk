-- A customer may pay one bill in several UPI transactions, sending each transaction
-- number separately. Each claim may only cover what is still unpaid and unclaimed.

drop index public.payment_claims_one_pending_idx;

create or replace function public.submit_payment_claim(
  p_bill_id uuid,
  p_amount_paise bigint,
  p_transaction_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.monthly_bills;
  v_remaining bigint;
begin
  -- Locked so two claims sent at once can't both use the same remaining amount.
  select * into v_bill from public.monthly_bills
  where id = p_bill_id and status in ('finalized', 'partially_paid')
  for update;
  if v_bill.id is null then
    raise exception 'This bill has nothing to pay';
  end if;
  if p_transaction_reference !~ '^[0-9]{12}$' then
    raise exception 'Enter the 12-digit UPI transaction number';
  end if;
  if exists (
    select 1 from public.payment_claims
    where transaction_reference = p_transaction_reference and status <> 'dismissed'
  ) or exists (
    select 1 from public.payments
    where transaction_reference = p_transaction_reference and voided_at is null
  ) then
    raise exception 'We already have this transaction number';
  end if;
  -- Limits what a stranger with the link can send.
  if (select count(*) from public.payment_claims
      where bill_id = p_bill_id and status = 'pending') >= 5 then
    raise exception 'We already have your payment details and will check them soon';
  end if;

  v_remaining := v_bill.total_payable_paise
    - coalesce((select sum(amount_paise) from public.payments
                where bill_id = p_bill_id and voided_at is null), 0)
    - coalesce((select sum(amount_paise) from public.payment_claims
                where bill_id = p_bill_id and status = 'pending'), 0);
  if v_remaining <= 0 then
    raise exception 'We already have your payment details and will check them soon';
  end if;
  if p_amount_paise < 1 or p_amount_paise > v_remaining then
    raise exception 'Enter an amount up to ₹%', to_char(v_remaining / 100.0, 'FM999999990.00');
  end if;

  insert into public.payment_claims (bill_id, amount_paise, transaction_reference)
  values (p_bill_id, p_amount_paise, p_transaction_reference);
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
    'pendingClaims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'amountPaise', pc.amount_paise, 'transactionReference', pc.transaction_reference
      ) order by pc.created_at)
      from public.payment_claims pc where pc.bill_id = bill.id and pc.status = 'pending'
    ), '[]')
  )
  from bill join public.customers c on c.id = bill.customer_id;
$$;

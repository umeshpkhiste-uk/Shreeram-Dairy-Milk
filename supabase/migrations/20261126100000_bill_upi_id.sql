-- The bill says where to pay: adds the business's UPI ID to the document.
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
    ), '[]')
  )
  from bill join public.customers c on c.id = bill.customer_id;
$$;

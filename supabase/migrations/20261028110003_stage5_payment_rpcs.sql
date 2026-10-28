-- Stage 5: payment RPCs.

create function public.record_payment(
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

  select customer_id, status into v_customer_id, v_status
  from public.monthly_bills where id = p_bill_id for update;
  if v_customer_id is null then
    raise exception 'Bill not found';
  end if;
  if v_status in ('draft', 'voided') then
    raise exception 'Cannot record a payment against a % bill', v_status;
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

create function public.void_payment(p_payment_id uuid, p_reason text)
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

  select bill_id into v_bill_id from public.payments where id = p_payment_id for update;
  if v_bill_id is null then
    raise exception 'Payment not found';
  end if;

  update public.payments
  set voided_at = now(), void_reason = p_reason
  where id = p_payment_id;

  perform public._recompute_bill_status(v_bill_id);

  select * into v_bill from public.monthly_bills where id = v_bill_id;
  return v_bill;
end;
$$;

revoke all on function public.record_payment(uuid, uuid, bigint, public.payment_method, text, text, date, text) from public, anon;
revoke all on function public.void_payment(uuid, text) from public, anon;

grant execute on function public.record_payment(uuid, uuid, bigint, public.payment_method, text, text, date, text) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;

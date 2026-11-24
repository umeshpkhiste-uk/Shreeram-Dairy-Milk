-- Admin resolution of a flagged delivery conflict. submit_delivery_event
-- keeps the original row, sets has_conflict, and logs the rejected submission
-- in delivery_events; until now only direct SQL could clear the flag.
--
-- p_event_id null: keep the current record. Otherwise apply that rejected
-- submission to it. Either way both stay in delivery_events / audit_logs.
create function public.admin_resolve_delivery_conflict(
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

  -- Matched on customer and day, not delivery_id: a duplicate creation
  -- carries its own device's id for the same day.
  select * into v_event from public.delivery_events
  where id = p_event_id
    and conflict
    and customer_id = v_delivery.customer_id
    and (payload->>'delivery_date')::date = v_delivery.delivery_date;
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

comment on function public.admin_resolve_delivery_conflict is
  'Admin-only: clears a delivery conflict, keeping the current record (null event) or applying the rejected submission.';

revoke all on function public.admin_resolve_delivery_conflict(uuid, uuid) from public, anon;
grant execute on function public.admin_resolve_delivery_conflict(uuid, uuid) to authenticated;

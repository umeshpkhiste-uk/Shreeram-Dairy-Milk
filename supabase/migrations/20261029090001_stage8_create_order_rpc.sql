-- create_order: the only write path for placing a one-time order. Prices are
-- always resolved server-side from the current products row — never trusts a
-- client-supplied price, same principle as resolve_milk_price_paise.

create function public.create_order(
  p_customer_id uuid,
  p_worker_id uuid,
  p_order_date date,
  p_notes text,
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
  v_item_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can place an order';
  end if;

  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'Unknown customer';
  end if;

  if not exists (select 1 from public.workers where id = p_worker_id) then
    raise exception 'Unknown worker';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one item';
  end if;

  insert into public.orders (customer_id, worker_id, order_date, notes)
  values (p_customer_id, p_worker_id, coalesce(p_order_date, current_date), nullif(p_notes, ''))
  returning * into v_order;

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
    values (v_order.id, v_product.id, v_quantity, v_product.price_paise, v_amount_paise);

    v_item_count := v_item_count + 1;
  end loop;

  return v_order;
end;
$$;

revoke all on function public.create_order(uuid, uuid, date, text, jsonb) from public;
grant execute on function public.create_order(uuid, uuid, date, text, jsonb) to authenticated;

comment on function public.create_order is
  'Admin-only. Resolves each item''s price from the current products row server-side; never trusts a client-supplied price.';

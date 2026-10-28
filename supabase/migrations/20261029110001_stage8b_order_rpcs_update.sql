-- Replace create_order to accept a walk-in customer name in place of a real
-- customer_id, and add update_order_items for editing an existing order's
-- items (used by the website's "Update the order" action). Both still
-- resolve prices server-side from the current products row — never a
-- client-supplied price, same principle as resolve_milk_price_paise.

drop function if exists public.create_order(uuid, uuid, date, text, jsonb);

create function public.create_order(
  p_customer_id uuid,
  p_worker_id uuid,
  p_order_date date,
  p_notes text,
  p_items jsonb, -- [{ "productId": uuid, "quantity": integer }, ...]
  p_walk_in_customer_name text default null
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
  v_walk_in_name text := nullif(trim(coalesce(p_walk_in_customer_name, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only an admin can place an order';
  end if;

  if (p_customer_id is not null) = (v_walk_in_name is not null) then
    raise exception 'Provide exactly one of a customer or a walk-in name';
  end if;

  if p_customer_id is not null and not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'Unknown customer';
  end if;

  if not exists (select 1 from public.workers where id = p_worker_id) then
    raise exception 'Unknown worker';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one item';
  end if;

  insert into public.orders (customer_id, worker_id, order_date, notes, walk_in_customer_name)
  values (p_customer_id, p_worker_id, coalesce(p_order_date, current_date), nullif(p_notes, ''), v_walk_in_name)
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
  end loop;

  return v_order;
end;
$$;

revoke all on function public.create_order(uuid, uuid, date, text, jsonb, text) from public;
grant execute on function public.create_order(uuid, uuid, date, text, jsonb, text) to authenticated;

comment on function public.create_order is
  'Admin-only. Exactly one of p_customer_id/p_walk_in_customer_name must be set. Resolves each item''s price from the current products row server-side.';

-- update_order_items: replaces an existing order's line items wholesale
-- (delete + reinsert), re-resolving prices from the current products row.
create function public.update_order_items(
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

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Unknown order';
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

revoke all on function public.update_order_items(uuid, jsonb) from public;
grant execute on function public.update_order_items(uuid, jsonb) to authenticated;

comment on function public.update_order_items is
  'Admin-only. Replaces an order''s items wholesale (delete + reinsert), re-resolving prices from the current products row.';

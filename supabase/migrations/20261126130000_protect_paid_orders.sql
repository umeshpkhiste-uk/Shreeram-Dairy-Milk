-- Deleting a product removes its lines from past orders (20261102090000). A paid
-- order must keep its total, so a product on one cannot be deleted.
create function public.keep_paid_order_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.order_items i
    join public.orders o on o.id = i.order_id
    where i.product_id = old.id and o.payment_status = 'paid'
  ) then
    raise exception 'This item is on a paid order, so it cannot be deleted. Turn it off instead.';
  end if;
  return old;
end;
$$;

revoke all on function public.keep_paid_order_items() from public, anon, authenticated;

create trigger keep_paid_order_items
  before delete on public.products
  for each row execute function public.keep_paid_order_items();

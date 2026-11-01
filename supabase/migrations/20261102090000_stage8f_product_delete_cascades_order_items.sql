-- Owner request: deleting a product from Settings must always remove it —
-- from the page and the database — even if it was used in a past order.
-- order_items.product_id previously had the default ON DELETE NO ACTION,
-- which rejected the delete with a foreign-key violation whenever the
-- product was referenced; the app caught that and silently deactivated the
-- product instead. Switching to ON DELETE CASCADE means deleting a product
-- now also removes its line item from any past order (the order itself and
-- its other items are untouched) — the explicit tradeoff asked for here.

alter table public.order_items
  drop constraint order_items_product_id_fkey;

alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products (id) on delete cascade;

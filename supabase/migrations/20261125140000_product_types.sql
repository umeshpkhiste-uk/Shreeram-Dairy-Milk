-- "Milk types" become product types: each has a unit, and curd, paneer and taak
-- join the list. Table and column names stay, so older app versions keep working.

alter table public.milk_types
  add column unit public.product_unit not null default 'litre';

comment on column public.milk_types.default_price_paise is
  'Default price per litre (unit = litre) or per kg (unit = kg), in paise (1/100 INR). Fixed-precision integer — never floating point.';
comment on column public.customer_milk_rates.price_paise is
  'Price per litre or per kg (see milk_types.unit), in paise. Fixed-precision integer — never floating point.';
comment on column public.customers.default_daily_quantity_ml is
  'Integer base unit of the customer''s product: millilitres for unit=litre, grams for unit=kg.';
comment on column public.deliveries.delivered_quantity_ml is
  'Integer base unit of the delivery''s product: millilitres for unit=litre, grams for unit=kg.';
comment on column public.bill_items.quantity_ml is
  'Integer base unit of the item''s product: millilitres for unit=litre, grams for unit=kg.';

-- Curd and Paneer use the price of Dahi and Paneer in the order items.
insert into public.milk_types (name, unit, default_price_paise) values
  ('Curd', 'kg', 14000),
  ('Paneer', 'kg', 45000),
  ('Taak', 'litre', 4000);

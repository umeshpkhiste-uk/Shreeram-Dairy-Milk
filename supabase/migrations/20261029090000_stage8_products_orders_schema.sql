-- Stage 8: one-time product orders (paneer, ghee, shrikhand, etc.) — separate
-- from the recurring daily milk subscription. No billing integration: these
-- are tracked for fulfillment only, same as the owner's price-list poster.

create type public.product_unit as enum ('litre', 'kg');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit public.product_unit not null,
  price_paise bigint not null check (price_paise >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.products.price_paise is
  'Price per litre (unit = litre) or per kg (unit = kg), in paise. Fixed-precision integer — never floating point.';

create trigger set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- orders ---------------------------------------------------------------------
-- One-time order for a customer, fulfilled by one assigned worker. No status
-- beyond active/cancelled — not part of the billing/payment flow.

create type public.order_status as enum ('active', 'cancelled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  worker_id uuid not null references public.workers (id),
  order_date date not null default current_date,
  status public.order_status not null default 'active',
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger set_created_by
  before insert on public.orders
  for each row execute function public.set_created_by();

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_worker_id_idx on public.orders (worker_id);
create index orders_order_date_idx on public.orders (order_date);

-- order_items ------------------------------------------------------------------
-- quantity is in the product's base unit: millilitres when the product's unit
-- is 'litre', grams when it's 'kg' — same integer-base-unit convention as
-- deliveries.delivered_quantity_ml. price_paise/amount_paise are snapshotted
-- at order time (never re-derived from a later product price change).

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  price_paise bigint not null check (price_paise >= 0),
  amount_paise bigint not null check (amount_paise >= 0),
  created_at timestamptz not null default now()
);

comment on column public.order_items.quantity is
  'Integer, in the product''s base unit: millilitres for unit=litre, grams for unit=kg.';

create index order_items_order_id_idx on public.order_items (order_id);

-- RLS --------------------------------------------------------------------------

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "products_select_any_authenticated"
  on public.products for select
  to authenticated
  using (true);

create policy "products_admin_insert" on public.products for insert to authenticated with check (public.is_admin());
create policy "products_admin_update" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "products_admin_delete" on public.products for delete to authenticated using (public.is_admin());

-- Workers see only orders assigned to them (read-only — no action taken from
-- the worker app, per owner decision; worker never sees pricing, see below).
create policy "orders_select_admin_or_assigned_worker"
  on public.orders for select
  to authenticated
  using (public.is_admin() or worker_id = (select auth.uid()));

create policy "orders_admin_insert" on public.orders for insert to authenticated with check (public.is_admin());
create policy "orders_admin_update" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "orders_admin_delete" on public.orders for delete to authenticated using (public.is_admin());

-- order_items visibility follows the parent order's visibility.
create policy "order_items_select_admin_or_assigned_worker"
  on public.order_items for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.worker_id = (select auth.uid())
    )
  );

create policy "order_items_admin_insert" on public.order_items for insert to authenticated with check (public.is_admin());
create policy "order_items_admin_update" on public.order_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "order_items_admin_delete" on public.order_items for delete to authenticated using (public.is_admin());

-- Seed the price-list poster's catalog (owner's "Shreeram Dudh Dairy" rates,
-- effective 1 Aug per the poster). Editable later like milk_types.
insert into public.products (name, unit, price_paise) values
  ('Cow Milk', 'litre', 6000),
  ('Buffalo Milk', 'litre', 7800),
  ('Paneer', 'kg', 48000),
  ('Dahi', 'kg', 14000),
  ('Cow Ghee', 'kg', 80000),
  ('Buffalo Ghee', 'kg', 90000),
  ('Shrikhand', 'kg', 32000),
  ('Aamrakhand', 'kg', 32000),
  ('Basundi', 'kg', 44000),
  ('Khava', 'kg', 40000);

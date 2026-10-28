-- Stage 2: core schema — profiles, customers, workers, routes, milk types,
-- customer-specific rates, business settings, audit logs.
--
-- Conventions:
--   * UUID primary keys (gen_random_uuid()).
--   * created_at / updated_at timestamptz on every table, auto-maintained.
--   * Money stored as bigint "paise" (1/100 INR) — never floating point.
--   * Delivery quantities (added Stage 3) will be stored as integer millilitres.
--   * No hard deletes for customers/workers — status flags only, so history survives.

create extension if not exists pgcrypto;

-- updated_at auto-maintenance -------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles ---------------------------------------------------------------------
-- One row per authenticated user (admin or worker). Created automatically when
-- a Supabase Auth user is created (see handle_new_user trigger below).

create type public.user_role as enum ('admin', 'worker');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'worker',
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per Supabase Auth user. role is never settable by the user themselves — see RLS policies and handle_new_user.';

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- New auth.users rows always start as an inactive, unprivileged 'worker'
-- profile. Promoting to admin, or activating a worker, is a deliberate
-- follow-up action by an existing admin (via the dashboard/SQL editor for the
-- first admin, or via the admin-create-worker Edge Function for subsequent
-- workers) — never automatic, and never something the new user can do to
-- themselves.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Unnamed user'),
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'worker'),
    false
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- routes -------------------------------------------------------------------

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.routes
  for each row execute function public.set_updated_at();

-- workers --------------------------------------------------------------------
-- Worker-specific operational fields. Identity/contact/active-status live on
-- profiles (shared with admin accounts); this table is a 1:1 extension.

create table public.workers (
  id uuid primary key references public.profiles (id) on delete cascade,
  route_id uuid references public.routes (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.workers
  for each row execute function public.set_updated_at();

create index workers_route_id_idx on public.workers (route_id);

-- milk_types -----------------------------------------------------------------

create table public.milk_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_price_paise bigint not null check (default_price_paise >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.milk_types.default_price_paise is
  'Default price per litre, in paise (1/100 INR). Fixed-precision integer — never floating point.';

create trigger set_updated_at
  before update on public.milk_types
  for each row execute function public.set_updated_at();

-- customers --------------------------------------------------------------------

create type public.customer_status as enum ('active', 'inactive');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile_number text not null,
  email text,
  address text not null,
  locality text,
  landmark text,
  assigned_worker_id uuid references public.workers (id) on delete set null,
  route_id uuid references public.routes (id) on delete set null,
  route_sequence integer,
  status public.customer_status not null default 'active',
  default_daily_quantity_ml integer not null check (default_daily_quantity_ml > 0),
  milk_type_id uuid not null references public.milk_types (id),
  preferred_delivery_window text,
  delivery_start_date date not null default current_date,
  notes text,
  billing_contact_name text,
  billing_contact_phone text,
  account_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),

  constraint customers_mobile_number_format check (mobile_number ~ '^\+?[0-9]{10,13}$')
);

comment on table public.customers is
  'Never hard-deleted — status is set to inactive instead, so delivery/billing history remains valid.';

create trigger set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create index customers_assigned_worker_id_idx on public.customers (assigned_worker_id);
create index customers_route_id_idx on public.customers (route_id);
create index customers_status_idx on public.customers (status);
create index customers_mobile_number_idx on public.customers (mobile_number);

-- customer_milk_rates ----------------------------------------------------------
-- Effective-dated, customer-specific pricing. The authoritative source for what
-- a delivery should be billed at — never read a "current price" off `customers`
-- directly, always resolve it through this table for the delivery's date.

create table public.customer_milk_rates (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  milk_type_id uuid not null references public.milk_types (id),
  price_paise bigint not null check (price_paise >= 0),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),

  constraint customer_milk_rates_date_range check (
    effective_to is null or effective_to >= effective_from
  )
);

comment on column public.customer_milk_rates.price_paise is
  'Price per litre, in paise. Fixed-precision integer — never floating point.';

create index customer_milk_rates_customer_id_idx on public.customer_milk_rates (customer_id);
create index customer_milk_rates_lookup_idx
  on public.customer_milk_rates (customer_id, milk_type_id, effective_from);

-- Prevent two open-ended (effective_to is null) rates for the same
-- customer + milk type at once — ambiguous for billing.
create unique index customer_milk_rates_one_open_rate_idx
  on public.customer_milk_rates (customer_id, milk_type_id)
  where effective_to is null;

-- business_settings ------------------------------------------------------------
-- Single-row table (id fixed to true) holding business-wide configuration.

create table public.business_settings (
  id boolean primary key default true constraint business_settings_singleton check (id),
  business_name text not null default 'Shreeram Daily Milk',
  contact_phone text,
  contact_email text,
  address text,
  currency_code text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.business_settings
  for each row execute function public.set_updated_at();

insert into public.business_settings (id) values (true);

-- audit_logs ---------------------------------------------------------------
-- Append-only. Populated by triggers (see stage2_audit_triggers.sql), not
-- directly by application code, so every write path is covered consistently.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only. Never store passwords, tokens, or other secrets in before_data/after_data.';

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

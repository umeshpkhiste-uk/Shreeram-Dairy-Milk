-- Stage 3: offline delivery recording and synchronization.
--
-- Authoritative delivery records live here, written through exactly one path
-- (the submit_delivery_event RPC in the next migration) so idempotency and
-- conflict handling are enforced in one place, never trusted to the client.
--
-- Quantities: integer millilitres. Money: bigint paise, snapshotted at
-- delivery time from customer_milk_rates so historical billing (Stage 5)
-- never depends on a price that may since have changed.

create type public.delivery_status as enum ('completed', 'partial', 'missed');
create type public.delivery_event_type as enum ('created', 'corrected');

-- deliveries -------------------------------------------------------------------
-- One row per (customer_id, delivery_date) under normal operation. The id
-- itself is generated on the device at the moment of the first "created"
-- event, so a retried upload of the same creation can never produce a
-- second row — see the unique index below and the RPC's duplicate handling.

create table public.deliveries (
  id uuid primary key,
  customer_id uuid not null references public.customers (id),
  worker_id uuid not null references public.workers (id),
  milk_type_id uuid not null references public.milk_types (id),
  delivery_date date not null,
  scheduled_quantity_ml integer not null check (scheduled_quantity_ml > 0),
  delivered_quantity_ml integer not null check (delivered_quantity_ml >= 0),
  status public.delivery_status not null,
  reason text,
  price_paise_snapshot bigint not null check (price_paise_snapshot >= 0),
  device_recorded_at timestamptz not null,
  server_created_at timestamptz not null default now(),
  version integer not null default 1,
  has_conflict boolean not null default false,
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),

  constraint deliveries_reason_required_unless_completed check (
    status = 'completed' or (reason is not null and length(trim(reason)) > 0)
  )
);

comment on table public.deliveries is
  'Authoritative delivery record. Written only through public.submit_delivery_event — never inserted/updated directly by any client role.';
comment on column public.deliveries.price_paise_snapshot is
  'Price per litre in paise, resolved from customer_milk_rates (or the milk type default) as of delivery_date at write time. Immutable afterward, even if pricing later changes.';
comment on column public.deliveries.version is
  'Optimistic concurrency token. A correction event must supply the version it was based on; a mismatch is flagged as a conflict instead of applied.';

create trigger set_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();

create unique index deliveries_customer_date_idx
  on public.deliveries (customer_id, delivery_date);
create index deliveries_worker_id_idx on public.deliveries (worker_id);
create index deliveries_delivery_date_idx on public.deliveries (delivery_date);

-- delivery_events ----------------------------------------------------------
-- Append-only, immutable log of every submission a device made. The id is
-- the device-generated event id and is the system's idempotency key: a
-- retried upload reuses the same id, so a second insert attempt is a
-- duplicate, not a new event.

create table public.delivery_events (
  id uuid primary key,
  delivery_id uuid not null,
  customer_id uuid not null references public.customers (id),
  worker_id uuid not null references public.workers (id),
  event_type public.delivery_event_type not null,
  payload jsonb not null,
  device_recorded_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  applied boolean not null default false,
  conflict boolean not null default false
);

comment on table public.delivery_events is
  'Append-only audit trail of submitted delivery events. Never updated or deleted once written.';

create index delivery_events_delivery_id_idx on public.delivery_events (delivery_id);
create index delivery_events_worker_id_idx on public.delivery_events (worker_id);

-- delivery_sync_receipts -----------------------------------------------------
-- One row per processed event id. The quick duplicate-check the RPC performs
-- before doing any other work, and the client/future admin screen's single
-- source of "yes, the server has this" independent of the raw event log.

create table public.delivery_sync_receipts (
  event_id uuid primary key references public.delivery_events (id),
  delivery_id uuid not null,
  outcome text not null,
  processed_at timestamptz not null default now()
);

comment on table public.delivery_sync_receipts is
  'One row per processed delivery_events.id. Existence of a row is the idempotency check: a retried upload with the same event id is answered from here, never reprocessed.';

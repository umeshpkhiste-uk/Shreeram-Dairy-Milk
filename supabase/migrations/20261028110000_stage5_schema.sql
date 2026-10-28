-- Stage 5: monthly billing, payments, PDF reports.
--
-- Billing policy (see docs/billing.md for the full write-up):
--   * Billable = deliveries rows with status in ('completed','partial') only. 'missed' is
--     excluded, and a scheduled customer-day with no deliveries row at all is never billed —
--     never charge for milk that was not actually recorded as delivered.
--   * A delivery can be billed at most once, ever — enforced below by a unique index on
--     bill_items.delivery_id scoped to non-voided bills.
--   * Payments are recorded against a specific bill, never a general customer wallet.
--   * Bill status is derived (not hand-set) except for the two explicit actions: finalize,
--     void. All writes go through RPCs in the next migrations — never direct table access.

create type public.bill_status as enum ('draft', 'finalized', 'partially_paid', 'paid', 'voided');
create type public.payment_method as enum ('cash', 'upi', 'bank_transfer', 'other');

create sequence public.bill_number_seq;

-- monthly_bills ----------------------------------------------------------------

create table public.monthly_bills (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  billing_month date not null,
  bill_number text not null unique default ('SDM-' || lpad(nextval('public.bill_number_seq')::text, 6, '0')),
  status public.bill_status not null default 'draft',
  previous_outstanding_balance_paise bigint not null default 0,
  subtotal_paise bigint not null default 0,
  adjustments_total_paise bigint not null default 0,
  total_payable_paise bigint not null default 0,
  flagged_for_review boolean not null default false,
  flagged_reason text,
  sent_at timestamptz,
  finalized_at timestamptz,
  finalized_by uuid references public.profiles (id),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint monthly_bills_billing_month_is_first_of_month check (
    billing_month = date_trunc('month', billing_month)::date
  )
);

comment on table public.monthly_bills is
  'Written only through create_draft_bill/recalculate_draft_bill/add_bill_adjustment/finalize_bill/void_bill/mark_bill_sent — never inserted/updated directly.';
comment on column public.monthly_bills.previous_outstanding_balance_paise is
  'Snapshotted at draft-creation time: sum over this customer''s prior non-voided bills of (total_payable - payments received).';

create trigger set_updated_at
  before update on public.monthly_bills
  for each row execute function public.set_updated_at();

-- One non-voided bill per customer+month — the duplicate-billing guard. A partial unique
-- index (not a plain unique constraint) so a voided bill never blocks a replacement.
create unique index monthly_bills_customer_month_active_idx
  on public.monthly_bills (customer_id, billing_month)
  where status <> 'voided';

create index monthly_bills_customer_id_idx on public.monthly_bills (customer_id);
create index monthly_bills_billing_month_idx on public.monthly_bills (billing_month);
create index monthly_bills_flagged_idx on public.monthly_bills (flagged_for_review) where flagged_for_review;

-- bill_items -------------------------------------------------------------------
-- One row per billed delivery. price_paise is copied from the delivery's own immutable
-- snapshot at bill-creation time, so a bill stays fully self-contained history.

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.monthly_bills (id) on delete cascade,
  delivery_id uuid not null references public.deliveries (id),
  delivery_date date not null,
  milk_type_id uuid not null references public.milk_types (id),
  quantity_ml integer not null check (quantity_ml >= 0),
  price_paise bigint not null check (price_paise >= 0),
  amount_paise bigint not null check (amount_paise >= 0),
  -- Denormalized from the parent bill's status by void_bill (an index predicate can't
  -- reference another table), so freeing a delivery for rebilling only needs this column.
  voided boolean not null default false
);

comment on table public.bill_items is
  'Written only by create_draft_bill/recalculate_draft_bill; `voided` is flipped by void_bill. A delivery may appear in at most one non-voided bill — see bill_items_delivery_once_idx.';

-- The double-billing guard: a delivery can be billed by at most one non-voided bill.
create unique index bill_items_delivery_once_idx
  on public.bill_items (delivery_id)
  where not voided;

create index bill_items_bill_id_idx on public.bill_items (bill_id);

-- bill_adjustments ---------------------------------------------------------------
-- Append-only. amount_paise is signed: negative = discount/credit, positive = extra charge.

create table public.bill_adjustments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.monthly_bills (id) on delete cascade,
  amount_paise bigint not null,
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.bill_adjustments is
  'Append-only. Written only by add_bill_adjustment — never updated or deleted.';

create index bill_adjustments_bill_id_idx on public.bill_adjustments (bill_id);

-- payments -----------------------------------------------------------------------
-- id is client-generated and is the idempotency key for record_payment, same pattern as
-- delivery_events.id in Stage 3.

create table public.payments (
  id uuid primary key,
  bill_id uuid not null references public.monthly_bills (id),
  customer_id uuid not null references public.customers (id),
  amount_paise bigint not null check (amount_paise > 0),
  method public.payment_method not null,
  method_detail text,
  transaction_reference text,
  payment_date date not null,
  notes text,
  recorded_by uuid references public.profiles (id),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);

comment on table public.payments is
  'Written only by record_payment/void_payment. id is client-generated and is the idempotency key for record_payment.';

-- The identifiable-duplicate-payment guard: the same transaction reference can't be recorded
-- twice against the same bill. Cash payments with no reference aren't mechanically checkable
-- here — that's left to admin diligence, documented rather than faked.
create unique index payments_bill_transaction_reference_idx
  on public.payments (bill_id, transaction_reference)
  where transaction_reference is not null and voided_at is null;

create index payments_bill_id_idx on public.payments (bill_id);
create index payments_customer_id_idx on public.payments (customer_id);

-- Audit trail, consistent with customers/workers/customer_milk_rates/deliveries.
create trigger audit_monthly_bills
  after insert or update on public.monthly_bills
  for each row execute function public.audit_row_change();

create trigger audit_bill_adjustments
  after insert on public.bill_adjustments
  for each row execute function public.audit_row_change();

create trigger audit_payments
  after insert or update on public.payments
  for each row execute function public.audit_row_change();

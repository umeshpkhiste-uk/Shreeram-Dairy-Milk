-- Stage 8b: walk-in (unregistered) customers on an order, and lightweight
-- per-order payment tracking (cash or UPI) — still deliberately separate
-- from monthly_bills/payments, per owner decision (see docs/web-admin.md).

alter table public.orders alter column customer_id drop not null;
alter table public.orders add column walk_in_customer_name text;

alter table public.orders add constraint orders_customer_xor_walk_in check (
  (customer_id is not null) <> (walk_in_customer_name is not null)
);

create type public.order_payment_status as enum ('unpaid', 'paid');

alter table public.orders add column payment_status public.order_payment_status not null default 'unpaid';
alter table public.orders add column payment_method public.payment_method;
alter table public.orders add column paid_at timestamptz;

comment on column public.orders.walk_in_customer_name is
  'Plain text name for a one-off/walk-in order not tied to a real customers row. Exactly one of customer_id/walk_in_customer_name is set (see orders_customer_xor_walk_in).';

-- business_settings: UPI ID to generate a payment QR code against.
alter table public.business_settings add column upi_id text;
comment on column public.business_settings.upi_id is
  'Business UPI VPA (e.g. name@okaxis), used to generate order-payment QR codes. No payment gateway — admin confirms payment manually.';

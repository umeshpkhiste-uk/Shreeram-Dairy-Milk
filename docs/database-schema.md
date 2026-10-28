# Database schema (Stage 2)

Project: `bdrtsrbmsoanrqjhesop` ("Shreeram Dairy Milk", Supabase, `ap-northeast-2`). Schema is
entirely version-controlled in `supabase/migrations/`; this file explains the *why* behind it.

## Tables

| Table | Purpose |
|---|---|
| `profiles` | One row per Supabase Auth user (admin or worker). `role`, `is_active`, `full_name`, `phone`. Created automatically by the `handle_new_user` trigger. |
| `workers` | Worker-only fields (`route_id`, `notes`). 1:1 extension of `profiles` — `workers.id = profiles.id = auth.uid()`. |
| `routes` | Delivery routes (`name`, `description`, `is_active`). |
| `milk_types` | Configurable milk types with a default price per litre (`default_price_paise`). |
| `customers` | Customer record: contact/address, assignment (`assigned_worker_id`, `route_id`, `route_sequence`), delivery defaults, billing contact. Never hard-deleted — `status` (`active`/`inactive`) only. |
| `customer_milk_rates` | Effective-dated customer-specific pricing. The authoritative source for what a delivery should be billed at (resolve by `customer_id` + `milk_type_id` + the delivery's date falling inside `[effective_from, effective_to)`). |
| `business_settings` | Single-row (`id = true`) table: business name, contact details, currency, timezone (`Asia/Kolkata` by default). |
| `audit_logs` | Append-only. Populated automatically by triggers on `profiles`, `workers`, `customers`, `customer_milk_rates` — never written directly by application code. |
| `deliveries` | Authoritative delivery record, one per `(customer_id, delivery_date)`. Written only through `submit_delivery_event` — never inserted/updated directly by any client role. Carries `price_paise_snapshot`, resolved at write time, so later pricing changes never alter history. |
| `delivery_events` | Append-only, immutable log of every submitted event. The event id (device-generated) is the system's idempotency key. |
| `delivery_sync_receipts` | One row per processed event id — the quick duplicate check and the canonical "yes, the server has this" record. |
| `monthly_bills` | One row per customer per billing month (unique among non-voided bills). Status (`draft`/`finalized`/`partially_paid`/`paid`/`voided`), running totals, and `flagged_for_review` for late-arriving deliveries. Written only through the billing RPCs. |
| `bill_items` | One row per billed delivery. `price_paise` is copied from the delivery's own immutable snapshot. A delivery can appear in at most one non-voided bill (`bill_items_delivery_once_idx`). |
| `bill_adjustments` | Append-only, signed `amount_paise` (negative = discount/credit), written only by `add_bill_adjustment`. |
| `payments` | `id` is client-generated and is the idempotency key for `record_payment`. A `(bill_id, transaction_reference)` can't repeat. |

Full design, the sync engine, and conflict-handling rules: [`docs/offline-sync.md`](offline-sync.md).
Full billing policy, RPC contracts, and the late-delivery flagging flow: [`docs/billing.md`](billing.md).

## Conventions

- UUID primary keys (`gen_random_uuid()`), `created_at`/`updated_at` on every table
  (auto-maintained by a `set_updated_at` trigger).
- Money: `bigint` paise (1/100 INR) — see `src/lib/money.ts` for the only place conversion
  to/from a rupee display string happens. Never floating point.
- Quantities (from Stage 3 onward): integer millilitres.

## Authentication & authorization

- **No public sign-up in the app.** `handle_new_user` auto-creates a `profiles` row for any
  new `auth.users` row as `role='worker', is_active=false` — a safe, unprivileged default,
  never automatically admin or active.
- **First admin account**: created once, manually, via the Supabase Dashboard
  (Authentication → Users → Add user), then promoted with direct SQL:
  ```sql
  update public.profiles set role = 'admin', is_active = true where id = '<their auth.users id>';
  ```
  This only works via direct database access (Supabase CLI / dashboard SQL editor), which
  requires the project's database credentials — a stronger trust boundary than the REST API.
  The `prevent_self_privilege_escalation` trigger explicitly allows this path (`auth.uid()`
  is null for direct DB connections) while still blocking any authenticated API caller from
  granting themselves admin or reactivating their own account.
- **Subsequent worker accounts**: created only through the `admin-create-worker` Edge
  Function (`supabase/functions/admin-create-worker`), callable only with a valid admin
  session JWT. It creates the `auth.users` row via the Admin API, then immediately activates
  the resulting profile (an admin-provisioned worker shouldn't sit in the default
  `is_active=false` state meant for public/ambiguous signups) and records an
  `ADMIN_CREATE_WORKER` audit log entry with the acting admin's id — the audit trigger alone
  can't see who called an Edge Function, since it runs as `service_role`.
- **Row-Level Security** is enabled on all 8 tables. Policy shape (verified live, not just
  read from the SQL — see "Verification" below):
  - `profiles`: a user sees/updates their own row; an admin sees/updates all.
  - `customers`: an admin sees/writes all; a worker sees only rows where
    `assigned_worker_id = auth.uid()`, and cannot write at all.
  - `customer_milk_rates`: admin-only, both directions — pricing is never exposed to workers.
  - `workers`, `routes`, `milk_types`: admin writes; workers get read-only, scoped where it
    matters (a worker's own `workers` row; their assigned `routes` row).
  - `audit_logs`: admin can read; nobody can write directly (only the audit triggers, which
    run as the table owner and bypass RLS).
  - `business_settings`: any authenticated user can read (not sensitive); admin-only update.
  - `deliveries`, `delivery_events`, `delivery_sync_receipts` (Stage 3): a worker reads only
    their own rows; an admin reads all. **No insert/update policy at all** for `authenticated`
    on any of the three — the only write path is the `submit_delivery_event` RPC (below),
    which performs its own authorization checks and is `SECURITY DEFINER`.

## Offline delivery sync (Stage 3)

`public.submit_delivery_event(...)` is the single write path for deliveries — see
[`docs/offline-sync.md`](offline-sync.md) for the full client-side design. Per call, it:
verifies the caller is an active worker; verifies the customer is currently assigned to them
(never trusts a cached assignment); answers from `delivery_sync_receipts` without reprocessing
if the event id was already seen (idempotent); resolves and snapshots the price at the
delivery's date via `resolve_milk_price_paise`; and applies a `created` event as an insert or a
`corrected` event as a version-checked update — a version mismatch or a same-day duplicate
creation is stored and flagged `conflict`, never silently merged or overwritten.

## Realtime (Stage 4)

`public.deliveries` is in the `supabase_realtime` publication
(`supabase/migrations/20261028100000_stage4_realtime.sql`), so admin screens can subscribe to
`postgres_changes` for useful online updates. Postgres Changes authorizes each event
per-subscriber against the table's existing RLS policy — no separate Realtime-specific
authorization was needed. Full client-side design: [`docs/admin-monitoring.md`](admin-monitoring.md).

## Verification (2026-10-28)

Run with the Supabase CLI against the live project (`supabase db advisors --linked`,
`supabase db query --linked`), not just a static read of the SQL:

- `supabase db push` — all migrations applied cleanly.
- `supabase db advisors --type security` — 0 issues after hardening, except one documented,
  intentional exception (`is_admin()` callable by any signed-in user — it only reveals the
  caller's own admin status, takes no input, and is used internally by every RLS policy).
- `supabase db advisors --type performance` — 0 issues (fixed "multiple permissive
  policies" by splitting `for all` admin policies into insert/update/delete so each table
  has exactly one SELECT policy).
- Live RLS tests with real, distinct sessions (not simulated):
  - Unauthenticated REST calls to `customers`/`profiles`/`audit_logs` → `200` with `[]`.
  - Signed-in admin → sees all profiles, all audit logs, can create/reassign customers and
    workers, can set customer-specific effective-dated rates.
  - Signed-in worker (own account) → sees only their own profile, zero audit logs, insert
    into `milk_types` rejected with `42501` (RLS violation).
  - Two distinct workers, one customer assigned to worker A → worker A sees it, worker B
    does not, and worker B's attempt to reassign it to themselves affects zero rows.
  - `admin-create-worker` Edge Function: rejected with `401` when called without a user JWT;
    succeeded end-to-end for an authenticated admin, with the resulting `profiles`/`workers`
    rows and audit trail (`INSERT profiles` → `UPDATE profiles` (activation) →
    `INSERT workers` → `ADMIN_CREATE_WORKER`, attributed to the real admin's id) all
    confirmed.
  - Effective-dated pricing: setting a second rate correctly closes the first
    (`effective_to` set the day before the new `effective_from`) and both remain in history.
  - All test data created for the above was deleted afterward; nothing synthetic remains in
    the production project.

## Verification — Stage 3 (2026-10-28)

- `supabase db push` — all 4 migrations applied cleanly.
- `supabase db advisors --type all` — 0 issues besides the two documented, intentional
  exceptions (`is_admin()` from Stage 2, and `submit_delivery_event()` itself — it's meant to
  be callable by any signed-in worker; that's the whole point).
- Live tests against the real project with a real worker JWT (`admin-create-worker` used to
  provision a temporary test worker, deleted afterward):
  - Valid `created` event → applied, correct `price_paise_snapshot` resolved from the milk
    type default.
  - The exact same event id retried → answered as a duplicate from the stored receipt, applied
    `true`, **no second row created**.
  - Event for a customer not assigned to the caller → rejected (`P0001`), not applied.
  - Negative `delivered_quantity_ml` → rejected by the `deliveries` check constraint (`23514`).
  - `corrected` event with a stale `expected_version` → stored, flagged `conflict: true`, the
    original row **left untouched** (`has_conflict` set, but `version`/`status`/quantity
    unchanged).
  - `corrected` event with the correct `expected_version` → applied, `version` incremented.
  - All test data (delivery, events, receipt, customer, worker) deleted afterward; project back
    to its pre-test state.

## Verification — Stage 4 (2026-10-28)

- `supabase db push` — the Realtime publication migration applied cleanly; confirmed via
  `select * from pg_publication_tables where pubname = 'supabase_realtime'` that `deliveries`
  is now listed.
- `supabase db advisors --type all` — unchanged from Stage 3 (same two documented exceptions).
- Live check against the real project: created a temporary worker and 4 customers (via
  `admin-create-worker` + direct SQL), recorded 3 deliveries for "today" (one each of
  completed/partial/missed), left the 4th customer with no delivery row, then issued the exact
  REST queries the app's `listCustomers`/`listDeliveriesForDate`/`listWorkers` functions make
  (as the admin). Results matched the pure-function unit tests exactly: 4 active customers, 1
  active worker, 1/1/1 completed/partial/missed, 1 no-record, 1,100 ml total, ₹60.50 estimated
  sales. All test data deleted afterward.

## Known follow-ups

- **Leaked password protection** (Supabase Auth → Password Security) is currently disabled
  for this project — flagged by `supabase db advisors`. It's a dashboard-only toggle (not
  controllable from this CLI version's `config.toml`); worth enabling before go-live.
- Milk-type default pricing is seeded (`Cow Milk` ₹55/L, `Buffalo Milk` ₹65/L) as a
  reasonable starting point — editable by an admin via the Milk Types screen (Stage 5).
- A worker deactivated or reassigned while they have unsynced deliveries queued offline will
  have those uploads rejected at sync time (by design — see `docs/offline-sync.md`, "Known
  limitations"). The evidence stays on the device; admin-side review/reconciliation of such
  cases isn't built yet.
- Billing: bulk "generate bills for every customer" and dedicated email/WhatsApp API
  integrations are deferred (the native share sheet covers sharing a PDF) — see
  `docs/billing.md`, "Deferred."

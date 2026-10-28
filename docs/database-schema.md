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

Added in later stages: `delivery_schedules`, `deliveries`, `delivery_events`,
`delivery_sync_receipts` (Stage 3); `monthly_bills`, `bill_items`, `bill_adjustments`,
`payments` (Stage 5); `device_sync_state` (Stage 3, if needed).

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

## Known follow-ups

- **Leaked password protection** (Supabase Auth → Password Security) is currently disabled
  for this project — flagged by `supabase db advisors`. It's a dashboard-only toggle (not
  controllable from this CLI version's `config.toml`); worth enabling before go-live.
- Milk-type default pricing is seeded (`Cow Milk` ₹55/L, `Buffalo Milk` ₹65/L) as a
  reasonable starting point — not fixed data, editable by an admin once Stage 5 adds a
  milk-type management screen (or directly via SQL in the meantime).

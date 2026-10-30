# Stage 7 — Admin website (Next.js + Vercel)

`apps/web` is a Next.js (App Router, TypeScript) admin console that talks to the exact same
Supabase project, schema, RLS policies, and RPCs as the mobile app — no second database, no
duplicated business logic, per [`docs/architecture.md`](architecture.md) rule 2.

## Why this was straightforward

Every financial/authorization rule already lives in Postgres (RLS policies and `SECURITY
DEFINER` RPCs — see `docs/database-schema.md`, `docs/billing.md`). A browser session
authenticated as an admin is indistinguishable, from Postgres's point of view, from the mobile
app's admin session: same JWT shape, same `auth.uid()`, same policies. Building the website was
therefore mostly a new *client* for an already-correct backend, not new backend work — no new
migrations were needed beyond what Stage 6 already shipped.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4.
- `@supabase/ssr` for cookie-based sessions — `src/lib/supabase/server.ts` (Server Components/
  Actions/Route Handlers) and `src/lib/supabase/client.ts` (Client Components only, unused by
  most of this app since almost everything is server-rendered).
- `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`) refreshes the session cookie on
  every request and redirects signed-out visitors to `/login`. This is a UX convenience only —
  the real authorization boundary is `requireAdmin()` (`src/lib/auth.ts`), called from
  `app/(admin)/layout.tsx`, which does a real `profiles` lookup (role + `is_active`) subject to
  RLS, the same pattern as the mobile app's `RouteGuard` + RLS. A signed-in **non-admin** (e.g. a
  worker who opens this site) is deliberately never bounced between `/login` and `/` — `/login`
  itself detects "signed in but not admin" and shows a sign-out option instead of looping.
- Data reads: Server Components call `src/lib/data/*.ts` directly (no API layer — see the
  Next.js data-patterns reference). Mutations: Server Actions in each route's `actions.ts`,
  calling the exact same RPCs the mobile app calls (`create_draft_bill`, `record_payment`,
  `submit_delivery_event`'s effects are read-only here, etc.).
- `supabase.functions.invoke('admin-create-worker', ...)` — the same Edge Function the mobile
  app calls, works identically from a server-side Supabase client; it attaches the caller's own
  session JWT automatically.

## `packages/shared`

A small framework-agnostic package of pure TypeScript — no React Native or Next.js import in
any of it — used **only by `apps/web`**, imported via a TypeScript path alias
(`@shreeram/shared` → `packages/shared/src/index.ts`), not an npm workspace or build step:
Next's bundler resolves it directly (`outputFileTracingRoot` in `apps/web/next.config.ts` is the
only config needed).

Contains (copied from `apps/mobile/src/lib/*` where the logic was already pure, with their
existing unit tests carried over): the hand-written `Database` type, `money.ts`,
`date.ts`, `lib/billing/status.ts`, the customer/bill/payment Zod validation
schemas, `lib/dashboard/metrics.ts` (dashboard aggregation + the daily delivery report
left-join), and `lib/pdf/bill-template.ts` (the bill HTML renderer, split into
`renderBillHtml` — a full standalone document, still used only by the mobile app's own copy —
and `renderBillBodyHtml`, used by the website's print page).

**Deliberately not shared**: `apps/mobile` was not changed to import from this package. Every
file placed in `packages/shared` is a *copy* of an already-shipped, already-tested mobile file,
not a move. Repointing the mobile app at this package would need Metro bundler monorepo
configuration (`watchFolders`, resolver changes) in an app that was already fully built, tested,
and shipped across 6 stages — a real risk for a cosmetic-only (`apps/mobile`'s side gets nothing
new) win. If `apps/mobile`'s copy of one of these files changes, update `packages/shared`'s copy
too (and vice versa) — noted at the top of each shared file that has a mobile counterpart.

## Pages

All under `src/app/(admin)/*` except `/login` — the route group's `layout.tsx` is the one place
`requireAdmin()` is called, covering every page beneath it:

| Route | Covers |
|---|---|
| `/` | Dashboard — identical metrics to the mobile app (shared `computeDashboardMetrics`), with a `?date=` date picker (today or any past date — `computeDashboardMetrics`'s `today` param is just "the reference date", so it works unchanged for a historical date; future dates are blocked client-side, `max={today}`). |
| `/customers`, `/customers/new`, `/customers/[id]` | List/filter/search, create, edit, deactivate/reactivate, customer-specific effective-dated pricing, billing history links. |
| `/workers` | Worker accounts (create via the Edge Function), routes, route assignment, activate/deactivate — closes a gap neither app had before (no deactivate-worker UI existed anywhere). |
| `/deliveries` | The daily delivery report — same left-join logic as the mobile app's admin screen, same "no record yet ≠ missed" rule. Each customer name links to `/deliveries/[customerId]`. |
| `/deliveries/[customerId]` | Per-customer delivery calendar (added post-launch, admin-website-only, per owner feedback) — see "Per-customer delivery calendar" below. |
| `/orders` | One-time product orders (paneer, ghee, dahi, etc.) — see "One-time product orders" below. |
| `/billing`, `/billing/[id]`, `/billing/[id]/print` | Month picker, create/view bills, full breakdown, adjustments, payments, finalize/recalculate/void, the flagged-for-review banner, a back button, a delivery summary (days delivered / total quantity / average per delivery), and the website's PDF path (see below). |
| `/payments` | Cross-customer payments ledger. |
| `/reports`, `/reports/print` | Billing-summary table + PDF export (`/reports/print`, the same browser-print-to-PDF mechanism as the bill/order PDFs — see "Report generation is PDF-only" below). |
| `/settings` | Business settings + order items (New Order catalog) management. |

## PDF bill generation

No server-side PDF rendering dependency (no headless Chromium/Puppeteer, which is heavy for a
Vercel serverless function and unnecessary complexity for this app's scale). `/billing/[id]/print`
renders the bill via `renderBillBodyHtml` (shared with the mobile app's layout) inside the admin
shell, with the sidebar hidden via `@media print` (`globals.css`'s `.no-print`), and a "Print /
Save as PDF" button that calls the browser's own `window.print()`. Same rule as the mobile app:
nothing here ever infers "the bill was sent" from printing/saving it — that's still the separate
`mark_bill_sent` action.

## Report generation is PDF-only

Per owner request, every report/export in the app uses the same browser-print-to-PDF mechanism —
no CSV or any other format, anywhere. `/reports/print` (the billing-summary report) follows the
exact pattern above, reusing `BILL_STYLE` from `packages/shared`. The old
`/api/reports/billing-summary` CSV Route Handler, `packages/shared/src/lib/csv.ts`, and the
mobile app's `src/lib/csv.ts`/`src/lib/export/share-csv.ts` were removed — the mobile Reports tab's
"Export CSV" button is now "Share PDF", generating a PDF via `expo-print`
(`src/lib/pdf/billing-summary-template.ts`) and opening the native share sheet, same mechanism as
the mobile bill PDF.

## Per-customer delivery calendar

`/deliveries/[customerId]` (admin website only — added post-launch per owner request, not built on
the mobile admin app). A month calendar for one customer: each day colored green (completed/
partial), red (missed), yellow ("customer informed — no delivery"), or neutral (no record yet);
clicking a day shows its detail and, unless that day already has a completed/partial delivery, a
form to mark it yellow with a reason. Below the calendar: a numeric summary (delivered/missed/
customer-informed/no-record day counts, total litres) for days up to today in the displayed
month, and the month's bill if one exists (status, total payable, a link into the existing
`/billing/[id]` page — which already has the Print/Save-as-PDF button, Stage 5 — satisfying "share
a report with the customer" without building a second PDF path).

**The 'skipped' status** (`supabase/migrations/20261028130000_stage7_skipped_delivery_status.sql`,
`...20261028130001_stage7_admin_mark_skipped_rpc.sql`) is new: a third non-delivered reason,
distinct from `missed` (worker didn't deliver, no advance notice). It's admin-only — the worker
app is unchanged, still only ever writes `completed`/`missed` via `submit_delivery_event`. Written
through a dedicated `admin_mark_delivery_skipped(customer_id, delivery_date, reason)` RPC rather
than `submit_delivery_event`, because that RPC hard-requires the caller to be the customer's own
assigned worker (by design, for the offline sync path) — wrong for an admin acting on any
customer. The new RPC: requires `is_admin()`, requires the customer to already have an assigned
worker (`deliveries.worker_id` is `not null`), requires a reason, and refuses to overwrite a day
that already has a `completed`/`partial` delivery. `skipped` is automatically excluded from
billing (`create_draft_bill` already whitelists `completed`/`partial` only) and automatically
satisfies the existing `deliveries` reason-required-unless-completed check constraint — no other
schema or RPC changed.

## One-time product orders

`/orders` (Stage 8, `supabase/migrations/20261029090000_stage8_products_orders_schema.sql`,
`...20261029090001_stage8_create_order_rpc.sql`) — a separate ad-hoc ordering flow for items
outside the daily milk subscription: paneer, dahi, ghee, shrikhand, aamrakhand, basundi, khava,
plus milk itself for one-off extra quantities. Deliberately **not** billing-integrated (owner
decision): orders never touch `bill_items`/`monthly_bills`, so they're tracked for fulfilment
only, same as the owner's price-list poster — not a payment record.

- `products`: a flat catalog (`name`, `unit` — `litre` or `kg`, `price_paise` per unit), seeded
  from the owner's poster prices, admin-editable (RLS: any authenticated select, admin-only
  write) the same way `milk_types` is.
- `orders` + `order_items`: one order per customer+date, one assigned worker (`orders.worker_id`,
  `not null`), one or more items. `order_items.quantity` is an integer in the product's base unit
  (millilitres for `litre`, grams for `kg`) — same convention as `deliveries.delivered_quantity_ml`,
  never a float. `price_paise`/`amount_paise` are snapshotted per item at order time.
- `create_order(customer_id, worker_id, order_date, notes, items)`: the only write path. Admin-only
  (`is_admin()`), and — same principle as `resolve_milk_price_paise` — always resolves each item's
  price from the current `products` row server-side, never from a client-supplied price.
- Worker visibility is **read-only**: RLS lets a worker `select` only orders where
  `worker_id = auth.uid()` (mirroring `customers`' assigned-worker policy), and the mobile app's
  new Orders tab never shows pricing — it's a delivery reminder (customer, date, item, quantity),
  not a financial record.

**Walk-in customers and per-order payment** (Stage 8b,
`supabase/migrations/20261029110000_stage8b_order_payment_and_guest.sql`,
`...20261029110001_stage8b_order_rpcs_update.sql`) — added after the owner placed a real order and
asked for more control over it:

- `orders.customer_id` is now nullable; `orders.walk_in_customer_name` holds a plain text name for
  a one-off order with no real customer record (`orders_customer_xor_walk_in` requires exactly one
  of the two). Nothing about a walk-in order is ever written to `customers`.
- `orders.payment_status` (`unpaid`/`paid`), `payment_method` (reuses the billing `payment_method`
  enum), and `paid_at` — a lightweight payment record **of the order itself**, still never touching
  `monthly_bills`/`payments` (same owner decision as before, reaffirmed when this was built).
- Each order on `/orders` has an action row: **Proceed for payment** (choose Cash on delivery or
  UPI — UPI generates a QR code server-side from `business_settings.upi_id` + the order total via
  the `upi://pay` deep-link scheme, admin taps "Mark as paid" once money is actually received —
  there's no payment gateway, so nothing confirms automatically), **Generate bill** (opens
  `/orders/[orderId]/print`, the same browser-print-to-PDF mechanism as the monthly bill, for
  sharing via email/WhatsApp), **Change the worker**, **Reschedule the delivery**, **Update the
  order** (opens an item-quantity editor prefilled with the order's current quantities, saves
  through `update_order_items`, which re-resolves prices from the current `products` row), and
  **Cancel the order**. (An earlier "Reset the order" button that opened the same editor blank was
  removed as redundant with Update.)
- `update_order_items(order_id, items)`: admin-only, replaces an order's `order_items` wholesale
  (delete + reinsert) — mirrors `create_order`'s price-resolution logic exactly.
- **Settings** no longer has a "Milk types" editor — it was replaced outright by an "Order items"
  section (same add/edit-price/deactivate UI, now over the `products` table) per owner request.
  This was a deliberate trade-off the owner confirmed: there is now no website UI to edit the
  recurring daily-subscription milk price (`milk_types.default_price_paise`) — `listAllMilkTypes`
  is still used elsewhere (customer forms, billing) to read milk type names, but `createMilkType`/
  `updateMilkType` were removed as dead code alongside the UI.

**Worker-app sync (closed in a follow-up pass)**: an admin's `skipped` marking needed no new sync
plumbing — `admin_mark_delivery_skipped` attributes the row to the customer's real assigned
worker (`deliveries.worker_id`), so it already flowed down through the existing
`listDeliveriesForWorkerSince` → `applyServerDelivery` pull (apps/mobile/src/lib/sync/
sync-engine.ts), same as any other delivery. The only real gap was display: the worker app's
status label/tone maps (Today's Route, the per-customer calendar, Delivery History) didn't know
the `skipped` value and fell back to a blank/wrong label. Fixed by adding it to each map
(`STATUS_LABEL`/`STATUS_TONE`), showing the admin's reason text inline on Today's Route and the
calendar's day-detail card, and letting the worker's own calendar browse forward into future
months (previously capped at the current month) so an advance skip shows up before that day
arrives — still view-only beyond today, same as always. A worker can still mark Yes/No on a day
admin already marked `skipped` (e.g. if the customer changes their mind and the worker actually
delivers) — that's a deliberate correction path, not a bug, via `submit_delivery_event`'s normal
`corrected` event flow.

## Cross-platform data consistency

Verified live against the real project (temporary worker/customer, inside a rolled-back SQL
transaction — same no-residue technique as every previous stage's live tests): a delivery
recorded through `submit_delivery_event` with a **worker** session (simulating the mobile app)
was immediately visible, with the correct amount, to the exact query the website's
`listDeliveriesForDate` issues as an **admin** session; `create_draft_bill` called as that admin
session produced the correct subtotal from that delivery. Both apps read and write the same
tables through the same RPCs — there is no separate sync step and therefore no window for the
two apps to disagree about a record's state.

## A cross-cutting bug found while building this

While porting `customer-rates.ts` to the website, closing a review of
`resolve_milk_price_paise`'s boundary condition (`effective_from <= as_of < effective_to`,
exclusive upper bound) found that both apps' "close the old rate" logic used the **day before**
the new rate's `effective_from` as the closing date — one day too early, leaving exactly that one
day resolved by neither the old nor the new customer rate (silently falling back to the milk
type's default price). Confirmed live, then fixed in both `apps/mobile/src/lib/api/
customer-rates.ts` and the new `apps/web/src/lib/data/customer-rates.ts`: `effective_to` is now
set to the new rate's `effective_from` itself. See `docs/billing.md` and the Stage 7 commit for
detail.

## Deployment

- Live at **<https://shreeram-dairy-milk.vercel.app>**. Vercel project `shreeram-dairy-milk`
  (team `umeshpkhiste-6627`), root directory `apps/web`, connected to the
  `umeshpkhiste-uk/Shreeram-Dairy-Milk` GitHub repository's `main` branch via the Vercel-for-
  GitHub app — every push to `main` auto-deploys to production; every other branch/PR gets a
  preview deployment.
- Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are set in
  Vercel's own project settings (Production + Preview + Development), never committed — see
  `apps/web/.env.example`.
- No service-role key anywhere in this app or its Vercel configuration.
- One-time setup this stage needed that a future redeploy won't: granting the Vercel connection
  access to the team, and installing the Vercel-for-GitHub app on the repository — both done via
  the dashboard's own consent flows, not something a CLI/API call can do unattended.

## Two deployment-time bugs found and fixed

Both only showed up against the real deployed build — neither `next build` nor `next dev`
locally exercises what Vercel's own install step or edge runtime does:

1. **`Module not found: Can't resolve 'zod'`, building `packages/shared/src/lib/validation/*.ts`.**
   Worked locally only because `npm install` had been run by hand inside `packages/shared`,
   creating a `node_modules` there — git-ignored, so it never existed on Vercel's fresh clone.
   Node resolves a bare import from the *importing file's own* directory upward; `apps/web`'s own
   `zod` dependency was never on that path. Fixed by turning the repo root into an npm workspace
   (`package.json` → `"workspaces": ["apps/web", "packages/shared"]`) so dependencies hoist into
   one shared root `node_modules` — `apps/mobile` deliberately excluded (see "Deliberately not
   shared" above).
2. **The proxy redirected `/_next/static/**` (CSS/JS) to `/login` for signed-out visitors**,
   breaking the login page's own styling/scripts in production — not reproducible with `next
   dev`. `proxyConfig.matcher`'s negative-lookahead regex (copied from a commonly-documented
   pattern) didn't actually exclude those paths at runtime. Fixed by adding a plain-JS early
   return inside `proxy()` itself (`isAlwaysPublicPath()`), which doesn't depend on matcher/
   path-to-regexp semantics — confirmed live afterward: the CSS file returns `200` with real
   content, `/`, `/billing`, and the CSV report API route all correctly `307` to `/login` for an
   anonymous request.

## Verification

- `npx tsc --noEmit`, `npx eslint .`, `npx next build` — all clean (see the Stage 7 commits for
  exact output); `packages/shared`'s own `npx tsc --noEmit` / `npx jest` also clean (31/31).
- `apps/mobile`'s full suite re-run after the `customer-rates.ts` fix: unchanged, still green.
- Live tests against the real Supabase project: the pricing-gap bug (confirmed, then fixed, then
  re-confirmed closed) and the cross-platform consistency check above. All temporary data
  created inside rolled-back transactions — nothing persisted.
- **The actual deployed production site**, verified with `curl` after each of the two fixes
  above: `/login` returns `200` with real rendered HTML; a static CSS asset returns `200` with
  real font-face/stylesheet content; `/`, `/billing`, and
  `/api/reports/billing-summary?month=2026-01-01` all correctly `307`-redirect an unauthenticated
  request to `/login` — the proxy's session check works in production, not just locally.

**Not verified — explicitly, not silently**: no interactive click-through of the deployed site
(signing in, creating a customer, a bill, a payment, printing one) was performed — no browser-
automation tool is available in this environment, only `curl`, which can't submit the
Supabase-authenticated sign-in form or exercise Server Actions the way a real browser does. An
admin should sign in once and walk through that full flow before relying on this for real
business use. No real `eas build`-equivalent concern here (web, not native), but see
`docs/android-release.md` for the mobile app's own outstanding manual-testing gap.

## Explicitly deferred (documented, not silently dropped)

- No Supabase Realtime subscriptions on the website (the mobile admin screens have them from
  Stage 4). Every page here is server-rendered per request, which is already fresh; adding
  Realtime would only matter for a page left open in a background tab for a long time — a minor
  convenience, not a correctness gap.
- No dedicated end-to-end (browser) test suite for the website, consistent with the mobile app's
  own state (Stage 6 noted the same gap there).
- Worker self-service (password reset, profile editing) is out of scope — this remains an
  admin-only console, matching the checklist's own framing ("responsive **admin** website").

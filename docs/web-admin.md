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
`date.ts`, `csv.ts`, `lib/billing/status.ts`, the customer/bill/payment Zod validation
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
| `/` | Dashboard — identical metrics to the mobile app (shared `computeDashboardMetrics`). |
| `/customers`, `/customers/new`, `/customers/[id]` | List/filter/search, create, edit, deactivate/reactivate, customer-specific effective-dated pricing, billing history links. |
| `/workers` | Worker accounts (create via the Edge Function), routes, route assignment, activate/deactivate — closes a gap neither app had before (no deactivate-worker UI existed anywhere). |
| `/deliveries` | The daily delivery report — same left-join logic as the mobile app's admin screen, same "no record yet ≠ missed" rule. |
| `/billing`, `/billing/[id]`, `/billing/[id]/print` | Month picker, create/view bills, full breakdown, adjustments, payments, finalize/recalculate/void, the flagged-for-review banner, and the website's PDF path (see below). |
| `/payments` | Cross-customer payments ledger. |
| `/reports` | Billing-summary table + CSV export (`/api/reports/billing-summary`, a Route Handler — see the Next.js data-patterns reference for why a file download needs one). |
| `/settings` | Business settings + milk type management. |

## PDF bill generation

No server-side PDF rendering dependency (no headless Chromium/Puppeteer, which is heavy for a
Vercel serverless function and unnecessary complexity for this app's scale). `/billing/[id]/print`
renders the bill via `renderBillBodyHtml` (shared with the mobile app's layout) inside the admin
shell, with the sidebar hidden via `@media print` (`globals.css`'s `.no-print`), and a "Print /
Save as PDF" button that calls the browser's own `window.print()`. Same rule as the mobile app:
nothing here ever infers "the bill was sent" from printing/saving it — that's still the separate
`mark_bill_sent` action.

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

- Vercel project `shreeram-daily-milk-web`, root directory `apps/web`, connected to the
  `umeshpkhiste-uk/Shreeram-Dairy-Milk` GitHub repository's `main` branch — every push to `main`
  auto-deploys to production; every other branch/PR gets a preview deployment.
- Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are set in
  Vercel's own project settings (Production + Preview), never committed — see
  `apps/web/.env.example`.
- No service-role key anywhere in this app or its Vercel configuration.

## Verification

- `npx tsc --noEmit`, `npx eslint .`, `npx next build` — all clean (see the Stage 7 commit for
  exact output); `packages/shared`'s own `npx tsc --noEmit` / `npx jest` also clean (31/31).
- `apps/mobile`'s full suite re-run after the `customer-rates.ts` fix: unchanged, still green.
- Live tests against the real Supabase project: the pricing-gap bug (confirmed, then fixed, then
  re-confirmed closed) and the cross-platform consistency check above. All temporary data
  created inside rolled-back transactions — nothing persisted.
- Deployed site: `curl` confirmed `/login` returns 200 with real content and that an
  unauthenticated request to `/` redirects to `/login` (the proxy's session check works in
  production, not just locally).

**Not verified — explicitly, not silently**: no interactive click-through of the deployed site
was performed (no browser-automation tool available in this environment) — an admin should sign
in once and walk through creating a customer, a bill, a payment, and printing a bill before
relying on this for real business use. No real `eas build`-equivalent concern here (web, not
native), but see `docs/android-release.md` for the mobile app's own outstanding manual-testing
gap.

## Explicitly deferred (documented, not silently dropped)

- No Supabase Realtime subscriptions on the website (the mobile admin screens have them from
  Stage 4). Every page here is server-rendered per request, which is already fresh; adding
  Realtime would only matter for a page left open in a background tab for a long time — a minor
  convenience, not a correctness gap.
- No dedicated end-to-end (browser) test suite for the website, consistent with the mobile app's
  own state (Stage 6 noted the same gap there).
- Worker self-service (password reset, profile editing) is out of scope — this remains an
  admin-only console, matching the checklist's own framing ("responsive **admin** website").

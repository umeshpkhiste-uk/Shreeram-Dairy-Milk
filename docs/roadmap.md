# Roadmap

Shreeram Daily Milk is built in 7 stages, each with its own acceptance criteria. We do not
move to the next stage until the current one's criteria are verified. This file is updated
as each stage completes.

| Stage | Name | Status |
|---|---|---|
| 1 | Project Foundation | ✅ Complete |
| 2 | Supabase, Authentication, Customers and Workers | ✅ Complete |
| 3 | Offline Delivery Recording and Synchronization | Not started |
| 4 | Admin Delivery Monitoring | Not started |
| 5 | Monthly Billing, Payments and PDF Reports | Not started |
| 6 | Security, Testing and Android Release | Not started |
| 7 | Future Website and Vercel Deployment | Not started |

## Stage 1 — Project Foundation ✅

**Delivered:**
- Monorepo layout: `apps/mobile`, `apps/web` (reserved), `packages/shared` (reserved),
  `supabase/migrations`, `supabase/functions`, `docs`, `tests`.
- Expo Router app (`apps/mobile`) on Expo SDK 58, TypeScript strict mode, ESLint
  (`eslint-config-expo`), Prettier, and Jest + React Native Testing Library.
- Design system tokens (`src/theme/tokens.ts`): dark-green primary, white/light-neutral
  background, neutral grey, restrained status colours, spacing/radius/font scales, and a
  48dp minimum touch target for outdoor use.
- Reusable UI components: `Text`, `Button`, `Input`, `Card`, `Screen`, `StatusBadge`,
  `EmptyState`, `ErrorState`, `LoadingState`, `OfflineBanner` (presentational; wired to real
  state in Stage 3).
- Two role-based navigators:
  - **Admin** (bottom tabs): Dashboard, Customers, Deliveries, Billing, More → Workers &
    Routes, Payments, Reports, Settings.
  - **Worker** (bottom tabs): Today's Route, Delivery History, Sync Status, Profile.
  - A temporary dev-only role picker (`src/app/index.tsx`) makes both reachable for review
    until Stage 2 adds real sign-in and role-based redirects.
- `.env.example`, `.gitignore` (mobile app + repo root), `eas.json` build profiles,
  `app.json` branding (name, bundle/package identifiers, icons, splash).
- GitHub Actions CI (`.github/workflows/mobile-ci.yml`): lint, format check, typecheck,
  test, `expo-doctor` on every push/PR touching `apps/mobile`.

**Verified:**
- `npx tsc --noEmit` — 0 errors.
- `npx eslint .` — 0 errors, 0 warnings.
- `npx jest` — 6/6 tests passing.
- `npx expo-doctor` — 20/20 checks passed.
- `npx expo export --platform web` — all 14 routes bundle successfully.

**Explicitly not implemented yet** (by design — Stage 1 is navigation/UI scaffolding only):
- No Supabase client, no authentication, no database of any kind.
- No offline storage (Expo SQLite) and no synchronization.
- No real data on any screen — every feature screen is a labelled placeholder stating
  which stage implements it.
- App icon/splash use the default Expo placeholder artwork; final brand artwork (milk-drop
  logo) is a known gap to fill before release, not a blocker for later stages.

## Stage 2 — Supabase, Authentication, Customers and Workers ✅

Project: `bdrtsrbmsoanrqjhesop`, Seoul region. Full detail, verification results, and the
admin-bootstrap / worker-provisioning flows: [`docs/database-schema.md`](database-schema.md).

**Delivered:**
- Schema: `profiles`, `customers`, `workers`, `routes`, `milk_types`,
  `customer_milk_rates` (effective-dated), `business_settings`, `audit_logs` — 7 migrations,
  all applied via `supabase db push`.
- RLS enabled and live-tested on all 8 tables with real, distinct admin/worker sessions
  (not simulated) — see verification log in `docs/database-schema.md`.
- Audit triggers on `profiles`, `workers`, `customers`, `customer_milk_rates` — append-only,
  unwritable directly by any role.
- Supabase Auth wired into the mobile app: `AuthProvider`, secure AES-encrypted session
  storage (`src/lib/supabase/large-secure-store.ts`), sign-in screen, role-based route
  guards (`RouteGuard`), pending-activation screen. No public sign-up screen.
- `admin-create-worker` Edge Function (`supabase/functions/admin-create-worker`) — the only
  way a worker account is created, admin-only, deployed and live-tested end-to-end.
- Customer management: list (search + status/worker/route filters), add, edit, deactivate/
  reactivate, duplicate-mobile-number confirmation, customer-specific effective-dated
  pricing.
- Worker & route management: list, add worker (via the Edge Function), route assignment,
  assigned-customer list with up/down reorder (`route_sequence`).
- `src/types/database.ts` — hand-written types matching the live schema (to be replaced by
  `supabase gen types` once that tool path is reliable in this environment).

**Verified:**
- `npx tsc --noEmit` — 0 errors. `npx eslint .` — 0 errors. `npx jest` — 25/25 passing.
- `npx expo-doctor` — 20/20. `npx expo export --platform web` — all routes bundle.
- `supabase db advisors --type security` / `--type performance` — 0 issues besides one
  documented, intentional exception.
- Live RLS and Edge Function tests against the real project, with all test data cleaned up
  afterward (see `docs/database-schema.md`).

**Explicitly not implemented yet** (by design — later stages' scope):
- No offline storage, no delivery recording of any kind (Stage 3).
- No worker self-service password change or invite-email flow (admin sets an initial
  password directly; a reasonable gap for this stage, not a blocker).
- No milk-type management UI (two sensible defaults are seeded; editable via SQL until
  Stage 5 adds a screen).
- Leaked-password protection is not yet enabled in Supabase Auth settings (dashboard-only
  toggle, flagged by advisors, worth doing before go-live).

## Stage 3 — Offline Delivery Recording and Synchronization

The highest-priority feature: Expo SQLite local database, the delivery-confirmation
workflow on Today's Route, a persistent sync outbox with idempotent uploads, bounded
retry/backoff, and conflict handling that never silently overwrites a delivery.

## Stage 4 — Admin Delivery Monitoring

Real dashboard numbers and a daily delivery report from actual Supabase records, with
filters and a clear distinction between "genuinely pending" and "completed offline, not
yet synced."

## Stage 5 — Monthly Billing, Payments and PDF Reports

Historical pricing, monthly bill calculation from billable deliveries only, bill
finalization as a transaction-safe server-side operation, payment tracking, and PDF
generation/sharing.

## Stage 6 — Security, Testing and Android Release

Production-readiness review: RLS verification across roles, data-integrity tests
(duplicates, conflicts, late records), mobile reliability tests, and Android release
preparation.

## Stage 7 — Future Website and Vercel Deployment

A Next.js admin website on the same Supabase project — no second database, no duplicated
business logic — deployed to Vercel.

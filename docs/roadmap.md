# Roadmap

Shreeram Daily Milk is built in 7 stages, each with its own acceptance criteria. We do not
move to the next stage until the current one's criteria are verified. This file is updated
as each stage completes.

| Stage | Name | Status |
|---|---|---|
| 1 | Project Foundation | ✅ Complete |
| 2 | Supabase, Authentication, Customers and Workers | Not started |
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

## Stage 2 — Supabase, Authentication, Customers and Workers

Database foundation (`profiles`, `customers`, `workers`, `routes`, `route_assignments`,
`milk_types`, `customer_milk_rates`, `business_settings`, `audit_logs`), Supabase Auth,
RLS policies enforced in PostgreSQL (not just hidden UI), and customer/worker/route CRUD.

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

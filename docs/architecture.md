# Architecture

## Technology stack

| Concern | Technology |
|---|---|
| Mobile app | React Native + Expo + TypeScript |
| Navigation | Expo Router |
| Backend / API | Supabase |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Offline local database | Expo SQLite |
| Future website hosting | Vercel |
| Source control | GitHub |
| File storage | Supabase Storage (only where required) |
| Testing | Jest, React Native Testing Library, Detox or Maestro (E2E, added later) |

## Non-negotiable rules

1. React Native is the mobile application framework, not the backend.
2. Supabase is the single central backend and database for both mobile and the future
   website. No second database, ever.
3. Expo SQLite is the local database for offline delivery records and the synchronization
   outbox — a cache and queue, not a second source of truth.
4. Vercel hosts the future website only, never the native Android/iOS app.
5. Both mobile and website use the same Supabase project, schema, business rules, and
   authorization model.
6. Supabase service-role keys and other privileged secrets never ship in mobile or browser
   code. Only `EXPO_PUBLIC_*` (anon/publishable) values reach the client, and those are
   still protected by Row-Level Security on the server.
7. Hiding a UI element is never a substitute for server-side authorization. Every
   authorization decision that matters is enforced in PostgreSQL (RLS) or in a Supabase
   Edge Function, not only in the client.
8. Monetary values use fixed-precision representations, never floating point. Delivery
   quantities are stored internally in millilitres (integers), never floating-point litres.
9. `Asia/Kolkata` is the business timezone, applied consistently across device, backend,
   reports, and (later) the website.

## Repository layout

See the root [`README.md`](../README.md#repository-layout).

## Mobile app structure (`apps/mobile/src/`)

```
app/            Expo Router routes only — every file here is a screen or layout
  (admin)/      admin tab navigator: dashboard, customers, deliveries, billing, more/*
  (worker)/     worker tab navigator: today, history, sync, profile
components/     reusable UI: text, button, input, card, screen, status-badge,
                empty-state, error-state, loading-state, offline-banner, placeholder-screen
hooks/          use-theme, use-color-scheme
theme/          design tokens (colors, spacing, radius, font sizes)
types/          shared app-level types (e.g. UserRole)
```

As Stage 2 onward add real screens, screen bodies that outgrow their route file move to
`src/screens/<name>/`, and Supabase/SQLite access code moves to `src/lib/` — per
[Expo's recommended project structure](https://expo.dev/blog/expo-app-folder-structure-best-practices).

## Design tokens

Defined in `apps/mobile/src/theme/tokens.ts`. Visual identity per the product brief:
white/light-neutral background, dark-green primary, neutral grey, restrained status
colours, and a 48dp minimum touch target (workers tap screens outdoors, often one-handed).
Both light and dark system appearances are supported; dark mode is not the primary design
target for this operations tool.

## Database (Stage 2)

Normalized PostgreSQL schema with UUID primary keys, foreign keys, unique constraints,
timestamps, and indexes on customer/worker IDs. Row-Level Security is enabled on every
table and has been live-tested with real, distinct admin and worker sessions — not just
read from the policy SQL. Full table list, RLS design, the admin-bootstrap and
worker-provisioning flows, and verification results: [`docs/database-schema.md`](database-schema.md).

## Authentication (Stage 2)

Supabase Auth. No public sign-up screen in the app — the only ways an account comes into
existence are (1) a one-time, manually-bootstrapped first admin account and (2) the
`admin-create-worker` Edge Function, callable only by an authenticated admin. See
`docs/database-schema.md` for the full flow.

## Offline synchronization (added in Stage 3)

Expo SQLite holds cached route/customer data and a persistent outbox of pending delivery
events. Synchronization is idempotent (unique device-generated event IDs + server-side
idempotency), retried with bounded exponential backoff, and never deletes a queued record
until the server acknowledges it. Full design documented in `docs/offline-sync.md` once
Stage 3 lands.

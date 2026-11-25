# Architecture

## Technology stack

| Concern | Technology |
|---|---|
| Admin website, worker web app | Next.js (App Router) + React + TypeScript + Tailwind |
| Backend / API | Supabase |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Offline local database (worker app) | IndexedDB (Dexie) |
| Offline screens (worker app) | Serwist service worker |
| Hosting | Vercel |
| Source control | GitHub |
| Testing | Jest |

## Non-negotiable rules

1. There are two web apps, `apps/web` for admins and `apps/worker-web` for workers. The mobile app
   was removed on 2026-11-25.
2. Supabase is the single central backend and database for both. No second database, ever.
3. IndexedDB is the worker app's local database for offline delivery records and the
   synchronization outbox — a cache and queue, not a second source of truth.
4. Vercel hosts both apps.
5. Both apps use the same Supabase project, schema, business rules, and authorization model.
6. Supabase service-role keys and other privileged secrets never ship in browser code. Only
   `NEXT_PUBLIC_*` (anon/publishable) values reach the client, and those are still protected by
   Row-Level Security on the server.
7. Hiding a UI element is never a substitute for server-side authorization. Every
   authorization decision that matters is enforced in PostgreSQL (RLS) or in a Supabase
   Edge Function, not only in the client.
8. Monetary values use fixed-precision representations, never floating point. Delivery
   quantities are stored as integer millilitres (grams for products sold by the kg), never
   floating point.
9. `Asia/Kolkata` is the business timezone, applied consistently across device, backend,
   reports, and both apps.

## Repository layout

See the root [`README.md`](../README.md#repository-layout).

## Design tokens

Each app's `src/app/globals.css`: white/light-neutral background, dark-green primary, neutral grey,
restrained status colours, and 48px minimum touch targets in the worker app (workers tap screens
outdoors, often one-handed).

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

## Offline synchronization

The worker app's IndexedDB holds cached route/customer data and a persistent outbox of pending
delivery events. Synchronization is idempotent (unique device-generated event IDs + server-side
idempotency via `submit_delivery_event`), retried with bounded exponential backoff, and never
deletes a queued record until the server acknowledges it. The protocol: `docs/offline-sync.md`; the
app: `docs/worker-web.md`.

## Admin website

`apps/web` is a Next.js admin console — no second database, no duplicated business logic. Full
design: `docs/web-admin.md`. `packages/shared` holds pure, framework-agnostic logic (types,
money/date helpers, validation, dashboard metrics, the bill HTML template) that both apps import
via a TypeScript path alias.

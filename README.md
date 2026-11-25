# Shreeram Daily Milk

A dairy business management system for daily doorstep delivery: customer and worker management,
offline-first delivery recording by delivery workers, monthly billing, and customer payment
tracking — an admin website and a worker web app, sharing one Supabase backend.

## Repository layout

```
apps/
  web/               Next.js admin website
  worker-web/        Next.js offline-first worker web app, for Chrome on Android
packages/
  shared/            types, validation and business logic used by both apps
supabase/
  migrations/        version-controlled SQL schema migrations
  functions/         server-side Edge Functions for sensitive operations
docs/                architecture, environment variables, roadmap, and other project docs
```

## Getting started

```bash
npm install                  # repo root, installs everything
npm run dev -w web           # admin website, http://localhost:3000
npm run dev -w worker-web    # worker app, http://localhost:3001
```

Each app needs a `.env.local` first — see [`docs/getting-started.md`](docs/getting-started.md).

Live: admin <https://shreeram-dairy-milk.vercel.app>, worker <https://shreeram-worker.vercel.app>.
Both deploy from `main`.

## Project status

Stages 1–7 are complete. Stage 8, the worker web app, is live and waiting for its test on a real
Android phone — see [`docs/roadmap.md`](docs/roadmap.md).

## Documentation

- [`docs/roadmap.md`](docs/roadmap.md) — the implementation plan and current status
- [`docs/architecture.md`](docs/architecture.md) — technology stack and architectural rules
- [`docs/getting-started.md`](docs/getting-started.md) — local development setup
- [`docs/environment-variables.md`](docs/environment-variables.md) — required env vars per app
- [`docs/database-schema.md`](docs/database-schema.md) — schema, RLS, auth bootstrap
- [`docs/web-admin.md`](docs/web-admin.md) — the admin website's design and Vercel deployment
- [`docs/worker-web.md`](docs/worker-web.md) — the worker web app and its Android test
- [`docs/offline-sync.md`](docs/offline-sync.md) — the delivery sync protocol
- [`docs/billing.md`](docs/billing.md) — monthly billing/payments policy and RPCs
- [`docs/security-review.md`](docs/security-review.md) — Stage 6 security/reliability audit
- [`docs/reference/`](docs/reference/) — original Master Prompt and Implementation Checklist

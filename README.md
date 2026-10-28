# Shreeram Daily Milk

A dairy business management system for daily doorstep milk delivery: customer and worker
management, offline-first delivery recording by delivery workers, monthly billing, and
customer payment tracking — a mobile app for admins/workers and an admin website, sharing one
Supabase backend.

## Repository layout

```
apps/
  mobile/            Expo (React Native + TypeScript + Expo Router) app — admin and worker roles
  web/               Next.js (App Router) admin website — added in Stage 7
packages/
  shared/            Framework-agnostic types/validation/logic used by apps/web (see docs/web-admin.md)
supabase/
  migrations/        version-controlled SQL schema migrations
  functions/         server-side Edge Functions for sensitive operations
docs/                architecture, environment variables, roadmap, and other project docs
tests/               cross-cutting integration/E2E tests that span more than one app
.github/workflows/   CI (lint, typecheck, test) for the mobile app
```

## Getting started

### Mobile app

```bash
cd apps/mobile
npm install
cp .env.example .env.local   # fill in from the Supabase dashboard
npm start
```

Then press `a` for Android, `i` for iOS, or `w` for web in the Expo CLI, or scan the QR
code with Expo Go / a development build on a physical device.

See [`apps/mobile/README.md`](apps/mobile/README.md) for the full Expo-generated
getting-started guide, and [`docs/getting-started.md`](docs/getting-started.md) for
project-specific setup (environment variables, linting, testing).

### Admin website

```bash
cd apps/web
npm install
cp .env.example .env.local   # same Supabase project URL/anon key as the mobile app
npm run dev
```

See [`docs/web-admin.md`](docs/web-admin.md) for the design, and
[`docs/android-release.md`](docs/android-release.md) for the Android build/release
procedure (mobile) — the website deploys to Vercel instead (see `docs/web-admin.md`,
"Deployment").

## Project status

All 7 planned stages are complete — see [`docs/roadmap.md`](docs/roadmap.md) for what each
stage delivered, what was verified, and what's explicitly deferred.

## Documentation

- [`docs/roadmap.md`](docs/roadmap.md) — the 7-stage implementation plan and current status
- [`docs/architecture.md`](docs/architecture.md) — technology stack and architectural rules
- [`docs/getting-started.md`](docs/getting-started.md) — local development setup (mobile)
- [`docs/environment-variables.md`](docs/environment-variables.md) — required env vars per app
- [`docs/database-schema.md`](docs/database-schema.md) — schema, RLS, auth bootstrap
- [`docs/offline-sync.md`](docs/offline-sync.md) — the mobile offline sync engine
- [`docs/billing.md`](docs/billing.md) — monthly billing/payments policy and RPCs
- [`docs/security-review.md`](docs/security-review.md) — Stage 6 security/reliability audit
- [`docs/android-release.md`](docs/android-release.md) — Android build and Play Store prep
- [`docs/web-admin.md`](docs/web-admin.md) — the admin website's design and Vercel deployment
- [`docs/reference/`](docs/reference/) — original Master Prompt and Implementation Checklist

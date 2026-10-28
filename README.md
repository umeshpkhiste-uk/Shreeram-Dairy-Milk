# Shreeram Daily Milk

A dairy business management system for daily doorstep milk delivery: customer and worker
management, offline-first delivery recording by delivery workers, monthly billing, and
customer payment tracking.

The mobile app is the current focus. A future admin website will share the same Supabase
backend, schema, and business rules (see [`docs/roadmap.md`](docs/roadmap.md), Stage 7).

## Repository layout

```
apps/
  mobile/            Expo (React Native + TypeScript + Expo Router) app — admin and worker roles
  web/               (future) Next.js admin website — added in Stage 7
packages/
  shared/            (future) shared TypeScript types and validation used by mobile + web
supabase/
  migrations/        version-controlled SQL schema migrations — added from Stage 2
  functions/         server-side Edge Functions for sensitive operations — added from Stage 2
docs/                architecture, environment variables, roadmap, and other project docs
tests/               cross-cutting integration/E2E tests that span more than one app
.github/workflows/   CI (lint, typecheck, test) for the mobile app
```

## Getting started (mobile app)

```bash
cd apps/mobile
npm install
cp .env.example .env.local   # fill in once Supabase is configured (Stage 2)
npm start
```

Then press `a` for Android, `i` for iOS, or `w` for web in the Expo CLI, or scan the QR
code with Expo Go / a development build on a physical device.

See [`apps/mobile/README.md`](apps/mobile/README.md) for the full Expo-generated
getting-started guide, and [`docs/getting-started.md`](docs/getting-started.md) for
project-specific setup (environment variables, linting, testing).

## Project status

Being built in phases — see [`docs/roadmap.md`](docs/roadmap.md) for the full 7-stage plan
and what each stage delivers. Current stage: **Stage 1 — Project Foundation** (complete).

## Documentation

- [`docs/roadmap.md`](docs/roadmap.md) — the 7-stage implementation plan and current status
- [`docs/architecture.md`](docs/architecture.md) — technology stack and architectural rules
- [`docs/getting-started.md`](docs/getting-started.md) — local development setup
- [`docs/environment-variables.md`](docs/environment-variables.md) — required env vars per app
- [`docs/reference/`](docs/reference/) — original Master Prompt and Implementation Checklist

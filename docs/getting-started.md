# Getting started

## Prerequisites

- Node.js 20+ and npm
- An Android device/emulator or iOS device/simulator for native testing, or a modern
  browser for the web target
- [Expo Go](https://expo.dev/go) (for quick device testing) or the ability to build a
  development client (`npx expo run:android` / `npx expo run:ios`) once native modules
  that Expo Go doesn't bundle are added (Expo SQLite, from Stage 3 onward)
- From Stage 2 onward: a free [Supabase](https://supabase.com) project

## Mobile app

```bash
cd apps/mobile
npm install
npm start
```

Press `a` (Android), `i` (iOS), or `w` (web) in the terminal, or scan the QR code with
Expo Go.

### Environment variables

Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and fill in real values. See
[`docs/environment-variables.md`](environment-variables.md) for what each variable is and
where to get it. **Never commit a file containing real values** — only `.env.example` is
tracked in git.

### Linting, formatting, type checking, tests

Run from `apps/mobile/`:

```bash
npm run lint          # ESLint (eslint-config-expo)
npm run format        # Prettier — writes changes
npm run format:check  # Prettier — check only, used in CI
npm run typecheck     # tsc --noEmit
npm test              # Jest + React Native Testing Library
npm run doctor         # expo-doctor — config/dependency sanity check
```

CI (`.github/workflows/mobile-ci.yml`) runs all of the above on every push/PR that touches
`apps/mobile/`.

### Resetting to a blank template (do not run on this project)

The Expo template ships a `reset-project` script that deletes the starter app code. This
project's `src/` is the real app, not starter boilerplate — do not run
`npm run reset-project`.

## Supabase (from Stage 2 onward)

Setup instructions, migration commands, and seed-data guidance will be documented here
once Stage 2 introduces the database schema and `supabase/migrations/`.

## Android builds (from Stage 6 onward)

EAS Build configuration (`apps/mobile/eas.json`) is already in place with `development`,
`preview`, and `production` profiles. Running an actual build requires an Expo account
(`eas login`) and linking the project (`eas init`), which is a one-time manual step not
automated by this repository. Full build/release instructions are documented in Stage 6.

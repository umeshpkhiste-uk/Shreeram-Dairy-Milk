# Shreeram Daily Milk — mobile app

Expo (React Native + TypeScript + Expo Router) app for the Shreeram Daily Milk dairy
delivery management system. See the [repo root README](../../README.md) and
[`docs/`](../../docs) for project-wide context, architecture rules, and the stage-by-stage
roadmap.

## Get started

```bash
npm install
npm start
```

Then press `a` (Android), `i` (iOS), or `w` (web), or scan the QR code with
[Expo Go](https://expo.dev/go).

Routes live under `src/app/` (file-based routing via [Expo Router](https://docs.expo.dev/router/introduction)).
Reusable UI lives in `src/components/`. Design tokens live in `src/theme/tokens.ts`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` / `ios` / `web` | Start and open on a specific platform |
| `npm run lint` | ESLint (`eslint-config-expo`) |
| `npm run format` / `format:check` | Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `test:watch` | Jest + React Native Testing Library |
| `npm run doctor` | `expo-doctor` — config/dependency sanity check |

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values once Supabase is configured
(Stage 2). See [`docs/environment-variables.md`](../../docs/environment-variables.md).

## Do not run `reset-project`

This template ships a `reset-project` script that deletes the app and starts from a blank
slate. `src/` here is the real, in-progress application — never run that script on this
project.

## Learn more about Expo

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction)

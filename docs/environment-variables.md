# Environment variables

## Mobile app (`apps/mobile/.env.example`)

| Variable | Added in | Required | Description |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Stage 2 | Yes, from Stage 2 | Your Supabase project's API URL (Project Settings → API). |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Stage 2 | Yes, from Stage 2 | The Supabase anon/publishable key (Project Settings → API). Safe to ship in a client bundle — it is designed to be public and is constrained by Row-Level Security. |

### Rules

- Only variables prefixed `EXPO_PUBLIC_` are available inside the mobile app bundle. Expo
  inlines them at build time; anyone who inspects the built app can read them. Never put a
  secret behind this prefix.
- `SUPABASE_SERVICE_ROLE_KEY` and any other privileged key must **never** appear in this
  app, in `.env.example`, or in any file committed to this repository. Privileged keys
  belong only in Supabase Edge Functions or other server-only environments, configured
  through Supabase's own secrets manager — never checked into git.
- Copy `.env.example` to `.env.local` locally and fill in real values. `.env.local` is
  git-ignored.
- In CI and in EAS Build, set the real values as encrypted environment variables /
  secrets in that platform's settings — never commit them.

## Future website (`apps/web`, added in Stage 7)

Will reuse `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Next.js's public
env convention) against the **same** Supabase project as the mobile app — not a separate
project or database. Documented fully when Stage 7 lands.

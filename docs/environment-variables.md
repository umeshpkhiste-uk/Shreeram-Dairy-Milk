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

## Admin website (`apps/web/.env.example`)

| Variable | Added in | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Stage 7 | Yes | Same Supabase project URL as the mobile app. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Stage 7 | Yes | Same anon/publishable key as the mobile app. |

Same rules as the mobile app's `EXPO_PUBLIC_*` variables: only `NEXT_PUBLIC_*` reaches the
browser bundle, never a secret. In Vercel, set both as the project's environment variables
(Production and Preview) — never commit real values. No service-role key is used anywhere in
this app; every server-side query still runs as the signed-in admin's own session, constrained
by RLS, via `@supabase/ssr`.

## Supabase project (CLI / migrations)

The repo root is linked to the Supabase project via `supabase link --project-ref
bdrtsrbmsoanrqjhesop` (run once; the link itself isn't a secret and isn't stored in the
repo — `supabase/.temp/` is git-ignored). To work on the database:

```bash
supabase db push --dry-run     # preview pending migrations
supabase db push                # apply them
supabase db advisors --linked --type all   # security/performance lint
```

No service-role key is needed for any of the above — the CLI authenticates with your own
Supabase account (`supabase login`), a separate, stronger trust boundary than the project's
API keys. See `docs/database-schema.md` for the schema itself and how the first admin
account is bootstrapped.

## Future website (`apps/web`, added in Stage 7)

Will reuse `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Next.js's public
env convention) against the **same** Supabase project as the mobile app — not a separate
project or database. Documented fully when Stage 7 lands.

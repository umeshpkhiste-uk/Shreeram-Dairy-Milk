# Environment variables

## Admin website and worker web app (`apps/web`, `apps/worker-web`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | The Supabase project's API URL (Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | The Supabase anon/publishable key. Designed to be public; constrained by Row-Level Security. |

Both apps use the same values. Put them in each app's git-ignored `.env.local`, and in each Vercel
project's environment variables (Production and Preview).

### Rules

- Only `NEXT_PUBLIC_*` reaches the browser, where anyone can read it. Never put a secret behind
  this prefix.
- `SUPABASE_SERVICE_ROLE_KEY` and any other privileged key must **never** appear in either app or
  in any file committed to this repository. Privileged keys belong only in Supabase Edge Functions,
  configured through Supabase's own secrets manager. Every server-side query in the admin website
  runs as the signed-in admin's own session, constrained by RLS, via `@supabase/ssr`.

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

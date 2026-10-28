# Android build and release

Everything needed to take this app from source to an installable Android build and, later,
a Google Play listing. Nothing here was run end-to-end against a real store listing — that
needs the user's own Google Play Console account — but every step is concrete and
copy-pasteable.

## 1. Supabase setup (recap)

Project `bdrtsrbmsoanrqjhesop` (Seoul region) is already provisioned. To point a fresh
checkout at it:

```bash
supabase login                              # once per machine
supabase link --project-ref bdrtsrbmsoanrqjhesop
```

Full schema/RLS/RPC reference: [`docs/database-schema.md`](database-schema.md),
[`docs/billing.md`](billing.md), [`docs/offline-sync.md`](offline-sync.md). No service-role
key is ever needed on a developer's machine — the CLI authenticates as the logged-in
Supabase account.

## 2. Database migrations

All schema changes are version-controlled SQL in `supabase/migrations/`, applied in
filename (timestamp) order:

```bash
supabase db push --dry-run     # preview what would run
supabase db push                # apply pending migrations to the linked project
supabase db advisors --linked --type all   # security/performance lint after every push
```

Never edit an already-applied migration file — add a new one. Never run `supabase db reset`
against the linked (production) project; that command is for the local dev stack only.

## 3. Environment variables

Full reference: [`docs/environment-variables.md`](environment-variables.md). Summary: only
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` exist, both safe to be public
(constrained by RLS). For a local build, copy `apps/mobile/.env.example` to
`apps/mobile/.env.local` and fill in both from the Supabase dashboard (Project Settings →
API). For an EAS cloud build, set the same two as EAS secrets instead (see §6) — `.env.local`
is git-ignored and never uploaded.

## 4. Backup and recovery

- **Database**: Supabase takes automatic daily backups on paid plans (check the project's
  plan under Settings → Database → Backups); point-in-time recovery availability depends on
  plan tier. For an ad-hoc manual backup before a risky change:
  ```bash
  supabase db dump --linked -f backup-$(date +%Y%m%d).sql
  ```
  Store that file outside the repo (it can contain real customer data) — never commit it.
- **Migrations themselves are the schema's backup/recovery mechanism**: every table,
  policy, and function is reproducible from `supabase/migrations/` alone against a fresh
  project, independent of the dashboard's own backups.
- **Mobile app**: there is no server-side backup of a device's local SQLite data by design —
  it's a cache/outbox, not a source of truth (see `docs/architecture.md`). The only data that
  must survive is what's already synced to Supabase; an unsynced delivery still sitting in
  the outbox when a device is lost/wiped is lost, which is why the sync engine attempts
  aggressively (app start, foreground, reconnect) rather than batching.

## 5. GitHub workflow

`.github/workflows/mobile-ci.yml` runs on every push/PR touching `apps/mobile/**`: install,
lint, format check, typecheck, Jest, `expo-doctor`. There is currently no CI job that runs
`supabase db push` automatically — database migrations are applied manually via the CLI
(intentional: an irreversible, production-affecting action shouldn't run unattended on every
push). Consider adding a manual-approval deployment workflow later if the team grows beyond
one person applying migrations directly.

## 6. Android build procedure (EAS)

`apps/mobile/eas.json` defines three profiles:

| Profile | Purpose | Output |
|---|---|---|
| `development` | Dev client for local testing with hot reload | Debug APK, internal distribution |
| `preview` | Share an installable build with testers without a Play listing | APK, internal distribution |
| `production` | Play Store submission | AAB (`app-bundle`), auto-incrementing version code |

```bash
npx eas-cli@latest login                        # once, already done for this account
npx eas-cli@latest build:configure               # first time only — links the project, writes an EAS project id
npx eas-cli@latest build --platform android --profile preview      # a shareable test build
npx eas-cli@latest build --platform android --profile production   # the real Play Store artifact
```

Local build config was verified in this stage without an actual cloud build:

```bash
npx expo prebuild --platform android --no-install
```

This confirmed the generated native project has `applicationId com.shreeramdairy.dailymilk`,
`versionCode 1`, `versionName "1.0.0"` — i.e. `app.json`'s config plugins
(`expo-router`, `expo-splash-screen`, `expo-secure-store`, `expo-sqlite`, `expo-sharing`)
all apply cleanly to a real Android project. `android/` is git-ignored and was deleted after
this check — it's Continuous-Native-Generation output, never hand-edited (see
`apps/mobile/AGENTS.md`).

**Not run in this environment** (needs the user's EAS account, consumes build
minutes/credits on their plan): an actual `eas build`. Running `build:configure` for the
first time will write an `extra.eas.projectId` into `app.json` — a one-time, low-risk,
reversible change, but still one that should happen under the user's own account rather than
unattended.

### Signing

EAS manages the Android keystore by default (`eas credentials`) unless you choose to supply
your own. For a first production build, let EAS generate and store it — it's retrievable
later from the same command if you need to move the keystore (e.g. to upload the app
yourself via a different path).

## 7. Google Play release preparation

Not yet started — no Play Console listing exists for this app. Checklist for when the user
is ready:

1. Create a Google Play Developer account (one-time $25 fee) if not already done.
2. Create a new app in Play Console, package name `com.shreeramdairy.dailymilk` (must match
   `app.json`'s `android.package` exactly — already set).
3. Produce a production AAB via `eas build --platform android --profile production`.
4. Either let EAS submit it directly (`eas submit --platform android`, needs a Play Console
   service account JSON key configured once — see Expo's EAS Submit docs) or upload the AAB
   manually through Play Console.
5. Fill in the Play Store listing: app description, screenshots, privacy policy URL (this
   app handles customer PII and payment records — a privacy policy is required by Play
   policy, not just good practice), content rating questionnaire, and the Data Safety form
   (declare what's collected: name, phone, address, payment records — all stored in Supabase
   under RLS, never shared with third parties beyond Supabase itself as the infrastructure
   provider).
6. Start on Internal Testing track first, not a public release — gather feedback from the
   actual dairy business's admin/workers before wider distribution.
7. App icon/splash: finish the final brand artwork (flagged since Stage 1) before the public
   listing — placeholder-adjacent icons are fine for internal testing, not for a public
   store page.

## 8. Known limitations and outstanding security risks

See [`docs/security-review.md`](security-review.md), "Known limitations and outstanding
risks" — not duplicated here to avoid the two documents drifting out of sync.

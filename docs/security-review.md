# Stage 6 — Security review, data-integrity tests, and mobile reliability

A production-readiness pass over the whole app: every RLS policy, the offline sync engine,
billing/payments, and local data handling. Two real defects were found and fixed (not just
written up) — see "Findings fixed" below. Everything in this document was either live-tested
against the real Supabase project, run as an automated check, or — where it genuinely needs a
physical Android device — called out explicitly as a manual step for the user to run (see
"Manual Android testing checklist").

## Findings fixed

### 1. Deactivated workers kept read access until their JWT expired

**Before:** `submit_delivery_event` (the only write path) already checked `is_active`, so a
deactivated worker could never create a delivery. But every worker-scoped RLS **select**
policy (`customers`, `routes`, `deliveries`, `delivery_events`) only checked "is this
assigned to me?", not "am I still active?". Supabase access tokens live up to an hour and
there's no server-side session revocation on deactivation, so a deactivated worker with a
still-unexpired token could keep *reading* their former customers' names/addresses and their
own delivery history for up to that long.

**Fix:** `supabase/migrations/20261028120000_stage6_security_hardening.sql` adds
`public.is_active_worker()` (same shape as the existing `is_admin()`) and requires it in the
worker branch of each affected policy. A deactivated worker now loses read access the moment
their profile is deactivated, regardless of token expiry.

Deliberately left unchanged: a worker's own `profiles` row (needed so the app can render
"pending activation"/deactivated state instead of just failing) and their own `workers` row
(not sensitive beyond what their own profile already reveals).

**Verified live** against the real project (SQL session using the same `request.jwt.claims`
GUC PostgREST sets per request, so it exercises the real policy evaluation without needing a
physical device to mint a token):

| Check | Result |
|---|---|
| Active worker reads their assigned customer | 1 row (allowed) |
| Same worker, same still-valid claims, deactivated mid-session | 0 rows from `customers` |
| Same deactivated worker | 0 rows from `deliveries` |
| Same deactivated worker | 0 rows from `routes` |

All test fixtures were created and the whole check run inside a transaction that was rolled
back — confirmed zero residual rows afterward.

### 2. Local SQLite cache/outbox was never cleared on sign-out

**Before:** `AuthProvider.signOut()` only called `supabase.auth.signOut()`. The local
`cached_customers`, `local_deliveries`, and `sync_outbox` tables were left exactly as they
were. If a different worker signed in on the same device next (or the same worker was
reactivated later), they would see the previous session's cached customer list and any
delivery drafts/outbox entries until the next full sync overwrote them — and if those
leftover outbox entries tried to sync under the new session, `submit_delivery_event` would
correctly reject them (wrong worker for that customer), but they'd sit permanently "failed"
on the new worker's Sync Status screen with no way to tell they belonged to someone else.

**Fix:** `src/lib/sqlite/clear-local-data.ts` (`clearAllLocalData()`) wipes
`sync_outbox`/`local_deliveries`/`cached_customers`/`cached_milk_types`/`sync_meta` in one
transaction. `AuthProvider.signOut()` now calls it after a successful
`supabase.auth.signOut()` (best-effort — a failure here never blocks sign-out). The worker
profile screen (`src/app/(worker)/profile.tsx`) now checks the outbox first: if there are
pending or failed (unsynced) deliveries, it warns with the exact count and requires an
explicit "Sign out anyway" confirmation before discarding them, instead of silently losing
real delivery data.

**Verified:** unit test (`src/lib/sqlite/clear-local-data.test.ts`) confirms the exact delete
statements run inside one transaction.

## Security review

| Item | Result |
|---|---|
| RLS enabled on every table | All 12 tables (8 from Stage 2/3, 4 from Stage 5) — confirmed via `supabase db advisors --type all` and the live tests in `docs/database-schema.md`/`docs/billing.md`, plus the new is_active check above. |
| Access as admin / worker / unauthenticated / unauthorized worker | Live-tested across Stages 2–5 (see those docs) and re-confirmed here for the deactivation case. |
| Role changes cannot be self-assigned | `prevent_self_privilege_escalation` trigger (Stage 2), still in place — only blocks when `auth.uid()` is non-null (an authenticated API caller), deliberately allowing direct-DB bootstrap of the first admin. Verified by code review; no change needed. |
| Leaked keys, tokens, secrets | `grep`-audited `apps/mobile` and `supabase/` for `service_role`/`SERVICE_ROLE` — only reference is inside the Edge Function's own server-side `ctx.supabaseAdmin`, never shipped to a client. `.env.local` is git-ignored; `.env.example` holds only placeholders. No real credentials found in git history for this repo. |
| Input validation and server-side authorization | Every write path is a `SECURITY DEFINER` RPC or Edge Function that re-validates and re-authorizes internally (never trusts client-supplied `created_by`/ids); Zod schemas validate on the client as the first line of defense, not the only one. |
| Local data retention and logout behaviour | Fixed — see Finding 2 above. |
| Offline sync does not bypass revoked access | `submit_delivery_event` already checked `is_active` (Stage 3); the RLS reads now match it (Finding 1). A deactivated worker's queued outbox items fail permanently (classified by Postgres error code, not retried forever) and are visibly marked failed. |
| Exports contain only authorized information | The one report export (billing summary — PDF, not CSV, as of a later pass; see docs/web-admin.md "Report generation is PDF-only") is admin-only, built only from data the admin's own session can already query — no export path exists on any worker screen. |

### Session and secure-storage review (code-reviewed, no device needed)

- Sessions are persisted via `LargeSecureStore` (`src/lib/supabase/large-secure-store.ts`):
  an AES-256-CBC-encrypted blob in `AsyncStorage`, with the encryption key itself held in
  `expo-secure-store` (iOS Keychain / Android Keystore) — never a plaintext session in
  `AsyncStorage`.
- `supabase.auth.startAutoRefresh()`/`stopAutoRefresh()` are wired to `AppState`, so the
  access token refreshes while the app is foregrounded and stops burning battery/requests
  while backgrounded.
- An expired/revoked session surfaces through `onAuthStateChange`'s `SIGNED_OUT` event,
  which `AuthProvider` already treats as `status: 'signedOut'`, redirecting via
  `RouteGuard`. No change needed.

## Data integrity

| Checklist item | Status |
|---|---|
| Duplicate delivery submissions | Live-tested in Stage 3 (`docs/database-schema.md`): same event id retried → answered from the stored receipt, no second row. |
| Repeated synchronization | Same mechanism — `runSync()` only ever marks an outbox item `done` once; a second sync pass with nothing new due is a no-op (`listDueOutboxItems` returns `[]`). |
| Simultaneous edits | Live-tested in Stage 3: a `corrected` event with a stale `expected_version` is stored and flagged `conflict`, never silently merged over the winning edit — this is exactly what "two workers/devices correcting the same delivery" resolves to, since the loser's `expected_version` is necessarily stale by the time it's applied. |
| Late delivery events | Live-tested in Stage 5 (`docs/billing.md`): a delivery synced after its bill was finalized sets `flagged_for_review` and leaves `total_payable_paise` untouched. |
| Historical price changes | **New, live-tested this stage** (see below): a delivery's `price_paise_snapshot` is immutable once written, regardless of later `customer_milk_rates` changes; a new effective-dated rate applies only from its own `effective_from` forward. |
| Duplicate bills and payments | Live-tested in Stage 5: duplicate `(customer, billing_month)` rejected; duplicate `payment_id` answered idempotently from the existing row; duplicate `(bill_id, transaction_reference)` rejected. |
| Audit records and transaction boundaries | Audit triggers fire on every insert/update to `profiles`/`workers`/`customers`/`customer_milk_rates`/`deliveries`/`monthly_bills`/`bill_adjustments`/`payments` and are themselves unwritable except by those triggers. Every RPC body is a single `plpgsql` function, which Postgres already runs as one transaction — there is no RPC that could leave a bill/payment/delivery half-written. |

### Historical price change — live test detail

Ran against the real project (temp customer/worker, rolled back afterward):

1. Set rate v1 (₹50/L) effective from 2026-01-01, open-ended.
2. `resolve_milk_price_paise` for 2025-12-31 (before any customer rate existed) correctly
   fell back to the milk type's default price.
3. `resolve_milk_price_paise` for 2026-03-01 correctly resolved to v1 (₹50/L); recorded a
   real `deliveries` row with that snapshot.
4. Closed v1 at 2026-06-01 and opened rate v2 (₹60/L) from 2026-06-01.
5. The delivery recorded in step 3 still has `price_paise_snapshot` = v1 — **unchanged** by
   the new rate.
6. `resolve_milk_price_paise` for 2026-07-01 now resolves to v2.
7. `resolve_milk_price_paise` for 2026-05-01 (still inside v1's original window) still
   resolves to v1, confirming the new rate didn't retroactively affect dates before its own
   `effective_from`.

All 5 checks passed exactly; test fixtures were deleted inside the same rolled-back
transaction.

## Mobile reliability

| Checklist item | Status |
|---|---|
| Slow networks / no network | Code-reviewed: `runSync()` checks `NetInfo.fetch()` before attempting anything and exits to `phase: 'offline'` with no requests sent; transient failures (network timeouts, 5xx) get bounded exponential backoff (`src/lib/sync/backoff.ts`), never an infinite tight retry loop. Needs a physical device for a true "slow 3G" field test — in the manual checklist below. |
| App closure and device restart | By design, not just by luck: every delivery save and outbox enqueue is a synchronous SQLite write in the same transaction (Stage 3) — nothing lives only in memory. Needs a physical device to confirm (manual checklist). |
| Expired sessions | Code-reviewed above (session/secure-storage review) — `SIGNED_OUT` → `RouteGuard` redirect. Needs a physical device to confirm the UX is not jarring (manual checklist). |
| Android back navigation and screen resizing | Expo Router's native stack/tabs handle Android back button and resizing by default; nothing in this app overrides that behavior. Needs a physical device/emulator (manual checklist). |
| Local database migrations | **New, unit-tested this stage**: `src/lib/sqlite/db.test.ts` verifies the versioned migration runner (a) runs every pending migration and advances `PRAGMA user_version` on a fresh database, (b) is idempotent — re-opening an already-migrated database re-runs nothing, matching an app restart, and (c) refuses to open a local database whose version is newer than the app understands (an existing safety check in `db.ts` that had no test before). |
| App remains usable when sync fails | Already true by design (Stage 3): a permanently-failed outbox item is marked `failed` and surfaced on the Sync Status screen with a manual retry button; it never blocks recording further deliveries. |

## Checks actually run

- `npx tsc --noEmit` — 0 errors.
- `npx eslint .` — 0 errors, 0 warnings.
- `npx prettier --check .` — clean except 3 pre-existing files unrelated to this stage
  (`README.md`, `scripts/reset-project.js`, `assets/expo.icon/icon.json` — not modified by
  Stage 6; flagged here rather than silently left out).
- `npx jest` — **77/77 passing** (74 before this stage + 3 new: `clear-local-data.test.ts`,
  2 of the 3 `db.test.ts` cases are new local-database-migration coverage, one new RLS/live
  test is not a Jest test since it ran directly against Postgres).
- `npx expo-doctor` — 20/20 checks passed.
- `npx expo export --platform web` — all routes bundle, including the sign-out flow change.
- `npx expo prebuild --platform android --no-install` — generates valid native Android
  project files with no errors; confirmed `applicationId com.shreeramdairy.dailymilk`,
  `versionCode 1`, `versionName "1.0.0"` in the generated `build.gradle`. The generated
  `android/` directory was deleted afterward (it's git-ignored and regenerated on demand —
  see `apps/mobile/AGENTS.md`).
- `supabase db push` — the new hardening migration applied cleanly.
- `supabase db advisors --linked --type all` — 0 issues beyond the now-11 documented
  "callable by `authenticated`"/"callable by `anon`" exceptions (every admin/worker-check
  RPC and helper function, all intentional — `is_admin()`, `is_active_worker()`, and the 9
  Stage 5 billing/payment RPCs plus `submit_delivery_event`) and the pre-existing
  leaked-password toggle.

**Not run — needs the user's EAS account and either costs build minutes or needs a physical
device:**
- A real `eas build --platform android --profile production` cloud build. Local `expo
  prebuild` above confirms the Android project configuration itself is valid, but doesn't
  compile/sign an actual app bundle. See `docs/android-release.md` for the exact command and
  what to check once it's run.
- Everything in the manual checklist below.

## Manual Android testing checklist

Needs a physical Android device or emulator — not available in this build environment.
Recommended before any Play Store release:

1. **Fresh install, airplane mode, record deliveries, restore network.** Install the app,
   sign in as a worker, enable airplane mode, record several deliveries (mix of completed/
   partial/missed), confirm they show as "pending" on the Sync Status screen and the
   OfflineBanner's pending count matches. Turn network back on and confirm they sync and the
   count drops to 0.
2. **Force-close and restart mid-queue.** With pending outbox items still unsynced, force-
   close the app (not just background it) and reopen. Confirm the pending deliveries and
   their data are still present — nothing was held only in memory.
3. **Slow network.** Using Android's developer options network throttling (or a tool like
   Charles Proxy), simulate a slow/flaky connection and confirm the app stays responsive
   (not blocked waiting on a sync call) and the sync eventually completes or backs off
   sensibly rather than hammering the network.
4. **Device restart.** Reboot the device entirely with pending outbox items queued. Reopen
   the app and confirm they're still there and still sync correctly.
5. **Sign out with unsynced deliveries.** Record a delivery while offline, then try to sign
   out before syncing. Confirm the new warning dialog appears with the correct count, and
   that choosing "Sign out anyway" actually clears the local cache (the next worker to sign
   in on this device sees a clean slate, not the previous worker's data).
6. **Deactivation while signed in.** Have an admin deactivate the signed-in worker's account
   from another device/session while the worker's app is open. Confirm the worker is
   redirected to the pending-activation screen within one token refresh cycle (or on next
   app foreground) and can no longer record deliveries.
7. **Android back button.** On every screen (worker and admin), confirm the hardware/
   gesture back button navigates sensibly (previous screen, not out of the app
   unexpectedly) and never leaves the app in a broken navigation state.
8. **Screen resizing / rotation / split-screen.** Test on at least one small phone and one
   tablet-sized screen (or Android split-screen mode) and confirm layouts don't clip or
   overlap, especially on the delivery-entry sheet and bill detail screen.
9. **Local database migration across an app update.** Install an older build, record some
   deliveries, then install this build over it (not a fresh install) and confirm existing
   local data survives and the app still works — this exercises the real migration runner
   against real on-device SQLite, not the Jest mock.
10. **Expired session.** Leave the app signed in and backgrounded for longer than the
    Supabase access token's lifetime with the device offline the whole time (so no refresh
    can happen), then bring it back online and foreground the app. Confirm it either
    silently refreshes or cleanly redirects to sign-in — never shows a broken/half-loaded
    screen.

## Known limitations and outstanding risks

- **Leaked password protection** (Supabase Auth → Password Security) remains disabled — a
  dashboard-only toggle, flagged by `supabase db advisors` since Stage 2. Recommended before
  go-live; cannot be enabled from this CLI/environment.
- **No server-side forced sign-out on deactivation.** Stage 6 closes the RLS read-access gap,
  but a deactivated worker's existing access token still authenticates (just returns no
  data) until it naturally expires. A true immediate revocation would need calling
  `supabase.auth.admin.signOut(userId, 'global')` from an admin-triggered Edge Function at
  deactivation time — not built, since the data-access gap it would close is already closed
  by Finding 1; this would only shorten the window in which a now-pointless token still
  authenticates at all.
- **Rate limiting / brute-force protection on sign-in** is whatever Supabase Auth provides by
  default; no additional app-side lockout or CAPTCHA was added. Reasonable for this app's
  scale (a handful of admin/worker accounts per business), worth revisiting if the user base
  grows.
- **The manual Android checklist above has not been executed** — it requires a physical
  device/emulator not available in this environment. This is the single biggest remaining
  gap before a confident production release.
- **No automated end-to-end (UI) test suite.** All testing here is unit tests (Jest) plus
  live, scripted tests directly against the Supabase API/database — there is no Detox/
  Maestro-style suite driving the actual app UI. Reasonable for this app's size; worth adding
  if the team grows or regressions in UI flows become a recurring issue.
- **App icon/splash still use placeholder-adjacent artwork** (noted since Stage 1) — not a
  security or correctness issue, but worth finishing before a Play Store listing.

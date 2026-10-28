# Offline delivery recording and synchronization (Stage 3)

The highest-priority feature per the Master Prompt: a worker must be able to record a
delivery entirely offline, see it saved instantly, and have it reach Supabase exactly once
— idempotent, bounded-retried, and never silently overwritten — once connectivity returns.

## Local database (Expo SQLite)

`apps/mobile/src/lib/sqlite/` — a cache and a durable queue, never a second source of truth
(`docs/architecture.md`, rule 3). Opened as a module-level singleton (`db.ts`), versioned
migrations gated by `PRAGMA user_version` (`schema.ts`):

| Table | Purpose |
|---|---|
| `cached_customers` | The worker's assigned, active customers — refreshed from the server whenever online. |
| `cached_milk_types` | Milk type names for display. Prices are never cached or shown to a worker (same rule as the server's RLS). |
| `local_deliveries` | One row per `(customer_id, delivery_date)` — the worker's own view of today's/recent status, including `sync_status` (`pending`/`syncing`/`synced`/`failed`/`conflict`) and the last sync error, if any. |
| `sync_outbox` | The durable queue. One row per submitted event, never deleted until the server acknowledges it. |
| `sync_meta` | Reserved key/value store for future sync bookkeeping. |

Quantities are integer millilitres throughout, matching the server schema. Workers never see
price — it's resolved and snapshotted server-side at delivery time (see `database-schema.md`).

## Recording a delivery

`src/lib/sqlite/deliveries-repo.ts`'s `recordDelivery()` does two things in **one SQLite
transaction**: upserts `local_deliveries` and enqueues the matching `sync_outbox` row. The two
are never out of sync, and nothing waits on the network — saving is a local, synchronous
operation, exactly per the checklist ("save a delivery immediately on the device... see the
updated status without waiting for a network response"). The first save for a customer/day is
a `created` event; editing an already-recorded one is a `corrected` event carrying the
`version` it was based on, for server-side conflict detection.

Event and delivery ids are generated on the device with `expo-crypto`'s `Crypto.randomUUID()`
— the event id is the idempotency key for everything downstream.

## Sync engine

`src/lib/sync/sync-engine.ts`. Triggers: app startup, app foreground (`AppState`), network
connectivity restored (`@react-native-community/netinfo`), and the manual "Sync now" button on
the Sync Status screen — all via `initSyncEngine()`, wired once in
`src/app/(worker)/_layout.tsx`.

Each run (`runSync()`):
1. Skips entirely if there's no session or the device is offline (checked via `NetInfo.fetch()`).
2. Pulls due outbox rows, oldest first, and calls `submit_delivery_event` (the server RPC) for
   each — see `database-schema.md` for what that RPC does.
3. On `applied`/`duplicate`: marks the outbox row `done` and the local delivery `synced`.
4. On `conflict`: marks the outbox row `done` (retrying won't resolve it — the server already
   recorded and flagged it) and the local delivery `conflict`, surfaced on the Delivery History
   and Sync Status screens for review. **Never silently overwritten.**
5. On a permanent rejection (Postgres `22xxx`/`23xxx`/`P0001` — validation or authorization,
   e.g. an unassigned customer): marks the outbox row `failed`, surfaced for manual review and
   retry. Not retried automatically — retrying wouldn't change the outcome.
6. On any other error (network failure, 5xx, timeout): reschedules with bounded exponential
   backoff (`src/lib/sync/backoff.ts` — 5s base, doubling, capped at 15 minutes) and leaves the
   local delivery `pending`. The row stays in the queue; nothing is lost.
7. Finally pulls the worker's cached customer/route/milk-type list and reconciles the last 14
   days of their own server-side deliveries — applied via `applyServerDelivery()`, which
   **never overwrites a local row that's still `pending`** (an unsynced edit always wins until
   it's uploaded).

A module-level `syncInFlight` flag prevents two syncs running concurrently.

## Idempotency and conflict handling (server-side contract)

Enforced in `public.submit_delivery_event` (`supabase/migrations/20261028090002_*.sql`), not
trusted to the device:

- The event id is the idempotency key. A retried upload (same event id) is answered from the
  stored `delivery_sync_receipts` row — never reprocessed, so a retry can never create a
  second delivery.
- A correction event includes the `version` it was based on (optimistic concurrency). A
  version mismatch — e.g. two devices correcting the same delivery — is stored as an immutable
  event, flagged `conflict = true`, and **not applied**. The original record is preserved.
- A customer id is independently re-checked against the caller's own current assignment on
  every call — a device cannot upload for a customer it's no longer assigned to, even if it
  cached that assignment earlier. See "Known limitations" below for what this means for work
  done just before a worker is deactivated.

## Known limitations / follow-ups

- **A revoked worker's queued-but-unsynced work**: per the checklist, authorization is
  re-checked at sync time, not trusted from the device's cache. If a worker is deactivated or
  reassigned while they have unsynced deliveries queued, those uploads will be rejected
  (`is_active`/assignment check fails) and marked `failed` locally — the evidence stays on the
  device (nothing is deleted), but it does not reach the server automatically. Reviewing and
  manually reconciling such cases is an admin task, not yet built (candidate for Stage 4).
- **Sync status / delivery history only show local data** — there's no Stage 4 admin-side view
  of conflicts yet; `deliveries.has_conflict` and `delivery_events.conflict` are there for that.
- **The manual Android airplane-mode test procedure** (per the checklist) needs a physical
  device or emulator, which isn't available in this build environment. Procedure to run
  manually:
  1. Install a development build on an Android device, sign in as a worker with at least one
     assigned customer.
  2. Enable airplane mode.
  3. Record 2–3 deliveries (a mix of completed/partial/missed) on "Today's Route." Confirm each
     saves instantly and shows up immediately in Delivery History with a "Not synced yet" badge.
  4. Force-close the app, reopen it (still in airplane mode). Confirm the recorded deliveries
     are still there with the same status — nothing was lost on restart.
  5. Disable airplane mode. Within a few seconds (or tap "Sync now" on the Sync Status screen),
     confirm the records move to "Synced."
  6. Repeat step 2–5 once more, this time correcting one of the already-synced deliveries while
     offline, to exercise the `corrected` event path end-to-end.

# Admin delivery monitoring (Stage 4)

Real dashboard numbers and a daily delivery report, computed from actual `deliveries` records
— never hardcoded — with the one distinction the checklist is explicit about: a missing
delivery record is never treated as proof of a missed delivery.

## Why "no record yet" exists as its own state

A worker's on-device sync status (Stage 3's `local_deliveries.sync_status`) lives only in that
worker's SQLite database — the server, and therefore the admin app, **never sees it**. From the
server's point of view there are only two states for a scheduled customer on a given date: a
`deliveries` row exists ("received by server"), or it doesn't. The second state is genuinely
ambiguous — it could mean the worker hasn't gotten there yet, or it could mean they delivered
it an hour ago while offline and haven't had a connection to sync since.

Every screen in this stage labels that second state **"No record yet"**, never "Missed," and
explains the ambiguity inline (`src/screens/admin/dashboard.tsx`'s tile hint,
`src/screens/admin/daily-delivery-report.tsx`'s row caption). "Missed" is reserved for a
delivery a worker actually recorded as missed — a real `deliveries` row with `status =
'missed'` and a reason.

## Dashboard (`src/screens/admin/dashboard.tsx`)

Tiles: active customers, active workers, scheduled today (active customers whose
`delivery_start_date <= today`), completed/partial/missed today, no-record-yet today, total ml
delivered today, and an estimated sales figure
(`sum(round(price_paise_snapshot * delivered_quantity_ml / 1000))` across today's deliveries —
rounded per delivery before summing, so there's no compounding drift; still only an *estimate*,
since authoritative billing math is Stage 5). All computed by the pure, unit-tested
`computeDashboardMetrics()` in `src/lib/dashboard/metrics.ts` from three plain queries
(`listCustomers`, `listWorkers`, `listDeliveriesForDate`) — no new SQL function needed at this
data scale.

Quick actions link to the screens that already exist: Add Customer, Add Worker, Assign Route,
View Today's Deliveries. The Master Prompt's "View Monthly Bills," "Record Payment," and
"Generate Reports" quick actions, and the "Outstanding customer balances" / "Current month
billing summary" tiles, have no backing data model yet (`bills`/`payments` tables don't exist)
— Stage 5 scope, left out rather than faked.

## Daily delivery report (`src/screens/admin/daily-delivery-report.tsx`)

One row per in-scope *active* customer for the selected date — built by left-joining the
filtered customer list with that date's `deliveries` rows
(`mergeDeliveryReport()` in `src/lib/dashboard/metrics.ts`, reused by
`listDailyDeliveryReport()` in `src/lib/api/deliveries.ts`). A customer with no delivery row
still appears as a row, labeled "No record yet," so an admin can actually "inspect incomplete
routes and investigate missing delivery confirmations" per the checklist, instead of those
customers silently vanishing from the list.

Filters: date (prev/next-day steppers plus a plain `YYYY-MM-DD` input — no new date-picker
dependency), worker, route (both `ChipSelect`, options from the existing `listWorkers`/
`listRoutes`), customer name/mobile search, and status (`completed`/`partial`/`missed`/
`no_record`, clearable).

Each row shows: customer, assigned worker, route, milk type, expected vs. actual quantity,
status, the device-recorded timestamp (if a delivery exists), whether it's been received by
the server, the exception reason (if any), and a "Flagged for review" badge when
`deliveries.has_conflict` is true (Stage 3's conflict flag — this is the only place in the app
that surfaces it; resolving a flagged conflict is still a manual SQL job, not yet a built admin
action).

## Realtime

`deliveries` is now in the `supabase_realtime` publication
(`supabase/migrations/20261028100000_stage4_realtime.sql`). Both screens subscribe via
`src/lib/realtime/deliveries-channel.ts`'s `subscribeToDeliveryChanges()`, which reloads on any
insert/update. Postgres Changes authorizes each event per-subscriber against the existing
`deliveries_select_admin_or_own_worker` RLS policy from Stage 3 — no separate Realtime
authorization setup was needed. The existing `useFocusEffect` pull-based refresh stays as the
explicit recovery path the checklist asks for, in case a push is ever missed (app was
backgrounded, briefly disconnected, etc.).

## Known follow-ups

- No admin action yet to resolve a flagged conflict (`has_conflict`) beyond direct SQL — a
  candidate for a later stage.
- Billing-dependent dashboard tiles and quick actions (outstanding balances, monthly billing
  summary, record payment, generate reports) arrive in Stage 5 once `bills`/`payments` exist.
- The dashboard's "estimated sales" figure is a same-day estimate from `deliveries` rows
  already on the server; it does not and should not match Stage 5's eventual authoritative
  monthly bill, which will also account for corrections, adjustments, and billing cycles.

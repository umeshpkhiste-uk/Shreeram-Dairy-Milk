# Monthly billing, payments and PDF reports (Stage 5)

## Billing policy

The checklist leaves several decisions to the implementation. Here's what this app does, and
why:

- **Billable = `deliveries` rows with `status in ('completed', 'partial')` only.** `missed` is
  excluded entirely, and a scheduled customer-day with **no `deliveries` row at all** (Stage
  4's "no record yet") is never billed — the explicit rule is "do not charge a customer for
  milk that was not delivered merely because it was scheduled." There is no `cancelled` status
  in this schema (only `completed`/`partial`/`missed`), so that checklist term doesn't apply.
- **A delivery can be billed at most once, ever.** `bill_items` has a unique index on
  `delivery_id` scoped to non-voided items (`bill_items.voided`, flipped by `void_bill`) — a
  mechanical guarantee against double-charging, not just a period-math assumption.
- **Payments are recorded against a specific bill**, never a general customer wallet. A
  customer's "previous outstanding balance" for their *next* bill is computed at
  draft-creation time as `sum over their prior non-voided bills of (total_payable − payments
  received)`. Simpler and more auditable than a separate running ledger.
- **Bill status is derived**, except for the two explicit actions `finalize_bill`/`void_bill`:
  `draft` until finalized; after finalization, `finalized`/`partially_paid`/`paid` recomputed by
  `record_payment`/`void_payment`/`add_bill_adjustment` from `sum(payments) vs total_payable`
  (see `public._recompute_bill_status`).
- **A late offline delivery never silently changes a finalized bill.** `submit_delivery_event`
  (Stage 3) was extended to check, after applying an event, whether a `finalized`/
  `partially_paid`/`paid` bill already exists for that customer's billing period — if so it
  sets `monthly_bills.flagged_for_review = true` with a reason, and leaves the bill's numbers
  untouched. An admin reviews the flag on the bill detail screen and either acknowledges it or
  issues a `bill_adjustments` correction.

## Schema and RPCs

Four new tables (`monthly_bills`, `bill_items`, `bill_adjustments`, `payments`) — see
`supabase/migrations/20261028110000_stage5_schema.sql` for the exact columns. RLS is
**admin-only select, with no insert/update/delete grant to `authenticated` at all** — every
write goes through one of these `SECURITY DEFINER` RPCs, each admin-checked internally:

| RPC | Purpose |
|---|---|
| `create_draft_bill(customer_id, billing_month)` | Computes previous balance, selects not-yet-billed billable deliveries, creates a `draft` bill. |
| `recalculate_draft_bill(bill_id)` | Draft-only; re-derives line items from scratch (picks up deliveries that synced in late). |
| `add_bill_adjustment(bill_id, amount_paise, reason)` | Signed amount — negative is a discount/credit. Allowed on draft or finalized bills, not voided. |
| `finalize_bill(bill_id)` | `draft` → `finalized`. |
| `void_bill(bill_id, reason)` | Any non-voided status → `voided`; frees its deliveries for a future bill. |
| `acknowledge_bill_flag(bill_id)` | Clears `flagged_for_review` after admin review. |
| `record_payment(payment_id, bill_id, amount_paise, method, …)` | Idempotent on the client-generated `payment_id` — a retry answers from the stored row, never double-records. Rejects a duplicate `(bill_id, transaction_reference)`. |
| `void_payment(payment_id, reason)` | Recomputes the bill's status excluding the voided payment. |
| `mark_bill_sent(bill_id)` | A deliberate admin confirmation — **never set automatically** just because the share sheet opened. |

`resolve_milk_price_paise` (Stage 3) is not reused directly for billing — the price is read
from each `deliveries.price_paise_snapshot`, already resolved and immutable at delivery time,
and copied into `bill_items.price_paise` so a bill stays fully self-contained history even if
`customer_milk_rates` changes later.

## Mobile app

- `src/lib/api/bills.ts` / `src/lib/api/payments.ts` — thin wrappers, same style as the rest of
  `src/lib/api/*`.
- `src/lib/billing/status.ts` — status label/tone maps, and `paymentOutcomeStatus()`, a pure
  mirror of the server's status-derivation logic used for optimistic UI.
- `src/lib/pdf/bill-template.ts` (pure HTML builder, unit-tested) + `src/lib/pdf/generate.ts`
  (thin `expo-print`/`expo-sharing` wrapper) — `Print.printAsync` for in-app preview,
  `Print.printToFileAsync` + `Sharing.shareAsync` for the native share sheet. **Opening the
  share sheet is not the same as the bill reaching the customer** — the app never infers "sent"
  from it; `mark_bill_sent` is a separate, explicit button.
- `src/lib/export/share-csv.ts` + `src/lib/csv.ts` — the one report export (Reports tab): a
  billing-period summary (customer, billed, paid, outstanding) as a shared `.csv`.
- Screens: `src/screens/admin/billing-list.tsx` (pick a month, see/create each customer's
  bill), `src/screens/admin/bill-detail.tsx` (full breakdown, adjustments, payments,
  finalize/recalculate/void, PDF preview/share, mark-sent, the flagged-for-review banner),
  `src/screens/admin/payments-ledger.tsx`, `src/screens/admin/billing-report.tsx`,
  `src/screens/admin/milk-types.tsx` (closing Stage 2's documented follow-up), and a Business
  Settings form added to `more/settings.tsx` (also a Stage 2 follow-up — needed for the PDF
  header).

## Deferred, documented rather than silently dropped

- **Bulk "generate bills for every customer for month X."** The admin creates one bill at a
  time from the Billing tab. Functionally complete, just less convenient for a large customer
  base — worth adding later if that becomes a real pain point.
- **Dedicated email/WhatsApp API integrations.** The native share sheet already offers
  WhatsApp/email/etc. on-device, which satisfies "share the PDF" without building or
  configuring an unconfigured third-party integration — consistent with the Master Prompt's own
  instruction not to integrate an unconfigured service (it says this explicitly about payment
  gateways; the same judgment applies here).
- **A broader reports suite.** Only the one CSV billing-summary export exists. Candidate for a
  later stage if more report types are wanted.
- **Admin-side resolution UI for a flagged conflict beyond acknowledging it** — acknowledging
  clears the flag; actually correcting the bill is done via `add_bill_adjustment`, a manual
  admin judgment call rather than an automated recalculation (recalculating a bill the customer
  may have already been sent would contradict "never silently modify a finalized bill").

## Verification (2026-10-28)

- `supabase db push` — all 7 migrations applied cleanly (including one same-day fix,
  `20261028110005_stage5_status_case_fix.sql`, for a `CASE` expression that resolved to `text`
  instead of the `bill_status` enum — caught live-testing `record_payment` before any client
  code shipped, not in production).
- `supabase db advisors --type all` — 0 issues beyond the now-10 documented
  "callable by `authenticated`" exceptions (every admin RPC, intentional — see
  `docs/database-schema.md`) and the pre-existing leaked-password toggle.
- Live tests against the real project (temporary worker/customer/deliveries, deleted
  afterward):
  - A month of 5 completed + 2 partial + 2 missed deliveries → `create_draft_bill` subtotal
    exactly matched hand-computed integer paise (17,600), missed deliveries excluded.
  - Duplicate bill for the same customer+month rejected with a friendly error.
  - A -₹10 discount adjustment applied correctly (17,600 → 16,600).
  - `finalize_bill` on a draft succeeded; a 2nd `create_draft_bill` for the same period while
    the first was still active was rejected.
  - Two partial payments walked the bill `finalized → partially_paid → paid` exactly at the
    boundary; a retried `record_payment` with the same `payment_id` was a no-op (only one
    `payments` row existed afterward); a duplicate `transaction_reference` on the same bill was
    rejected (`23505`).
  - A late `submit_delivery_event` for a date inside the now-`paid` bill's period set
    `flagged_for_review = true` with a reason, and **left `total_payable_paise` unchanged**.
  - `void_bill` freed its deliveries; a new draft for the same customer+period picked up both
    the original deliveries and the late one (subtotal 20,350 — correct).
  - A worker's session got zero rows from `monthly_bills`/`bill_items`/`bill_adjustments`/
    `payments` (RLS).
  - All test data deleted afterward; the project is back to its pre-test state.
- `npx tsc --noEmit`, `npx eslint .`, `npx jest` (73/73), `npx expo-doctor` (20/20), `npx expo
  export --platform web` (all routes, including the new `billing/[id]` and `milk-types`,
  bundle).

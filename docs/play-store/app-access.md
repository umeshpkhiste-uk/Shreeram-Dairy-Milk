# App access — reviewer login

Play Console → **App content → App access → "All or some functionality is restricted" → Add
instructions**. Without working credentials, Google rejects the review. Never paste a real
staff member's password here.

## 1. Create two dedicated reviewer accounts (one-time)

Do this before submitting, on the **web admin** (https://shreeram-dairy-milk.vercel.app) or the
mobile admin app:

1. **Workers → Add worker** — name `Play Reviewer (Worker)`, email e.g.
   `play-review-worker@<your domain or a mailbox you control>`, a strong unique password.
2. Assign 2–3 **test customers** to that worker (create them as `Test Customer 1`, `Test
   Customer 2`… with a dummy address — don't expose real customers' details to Google's
   reviewers).
3. Create an admin reviewer: an admin account named `Play Reviewer (Admin)` the same way your
   own admin account was created (Supabase Auth user + `profiles.role = 'admin'`).

Keep both accounts active for as long as the app is on Play — reviewers re-check on every
update. Deactivate (not delete) them only if you unpublish.

## 2. What to enter in Play Console

Add **two** instruction entries:

**Entry 1 — Worker**
- Name: `Delivery worker`
- Username: _the worker reviewer email_
- Password: _its password_
- Any other information:
  `Sign in on the first screen. "Today's Route" lists assigned test customers; tap one to open the calendar and mark today's delivery. "Sync Status" shows today's totals and sync state. Works offline.`

**Entry 2 — Administrator**
- Name: `Administrator`
- Username: _the admin reviewer email_
- Password: _its password_
- Any other information:
  `Sign in on the first screen. Tabs: Dashboard, Customers, Deliveries (daily report and per-customer calendar), Billing (monthly bills, payments, PDF share), More (workers, reports, settings). Accounts are created by the business; there is no public sign-up.`

Tick **"No other information is required to access my app"** only if the above is complete.

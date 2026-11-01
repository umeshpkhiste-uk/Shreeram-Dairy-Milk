# Data safety form — answers

Play Console → **App content → Data safety**. Answers below match what the code actually does
(checked 2 November 2026: no analytics/crash/ads SDKs, no location/camera/contacts
permissions, all traffic over HTTPS to Supabase). Re-check this file if any of that changes —
e.g. adding Sentry, maps, or push notifications means new declarations.

## Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS/TLS to Supabase) |
| Which methods of account creation does your app support? | **Username and password.** Nobody can sign themselves up, but an admin can create worker accounts from inside the app, so don't pick "My app does not allow users to create an account" — that would also skip the account-deletion requirement Google expects us to meet. |
| Account deletion URL | `https://shreeram-dairy-milk.vercel.app/delete-account` |
| Do you provide a way for users to request that some or all of their data is deleted, without deleting their account? | **Yes** (same page / contact email) |

## Data types

Mark only these. For every one: **Collected = Yes, Shared = No**, **Processed ephemerally = No**,
**Required (users can't turn it off)**.

| Category → Type | Why it's collected (purposes to tick) |
|---|---|
| Personal info → **Name** | App functionality; Account management |
| Personal info → **Email address** | App functionality; Account management |
| Personal info → **Phone number** | App functionality |
| Personal info → **Address** | App functionality (customer delivery addresses) |
| Personal info → **User IDs** | App functionality; Account management (Supabase account ID) |
| Financial info → **Purchase history** | App functionality (deliveries, one-time orders, monthly bills) |
| Financial info → **Other financial info** | App functionality (payments received: amount, method, reference) |

Do **not** tick: Location, Web browsing, Messages, Photos/videos, Audio, Files and docs,
Calendar, Contacts, App activity, App info and performance (no crash logs/diagnostics are
collected), Device or other IDs, Health and fitness, Credit card / bank account numbers
(only a free-text payment reference is stored, never card or account numbers).

## Why "Shared = No"

Supabase (database/auth) and Vercel (admin website hosting) process data **on our behalf** as
service providers — Google's definition excludes service providers from "sharing". PDFs sent
by an admin through the phone's share sheet are a user-initiated transfer, also excluded.

## Security practices section

- Data is encrypted in transit: **Yes**
- Users can request data deletion: **Yes**
- Committed to Play Families Policy: **No** (not a children's app)
- Independent security review: **No**

# App content declarations — answers

Play Console → **Policy → App content**. Each section must be completed before the first
release (internal testing included).

## Privacy policy

`https://shreeram-dairy-milk.vercel.app/privacy` — text in [privacy-policy.md](privacy-policy.md).
Deploys automatically from `main` via Vercel; open the URL once to confirm it loads without
signing in before pasting it into Play Console.

## App access

**"All or some functionality is restricted"** — every screen is behind sign-in. Google's
reviewers need working credentials or the review is rejected. See
[app-access.md](app-access.md) for exactly what to enter and how to create the reviewer
accounts.

## Ads

**No, my app does not contain ads.**

## Advertising ID

**No** — the app doesn't use the advertising ID. (Expo doesn't add the
`com.google.android.gms.permission.AD_ID` permission unless an ads/analytics library asks
for it; none is installed. If a build ever does include it, Play Console will warn on upload
— answer to match.)

## Content rating

Use the IARC questionnaire; answers in [content-rating.md](content-rating.md). Expected
result: **Everyone / 3+ / PEGI 3** everywhere.

## Target audience and content

- Target age groups: **18 and over** only.
- Appeals to children: **No**.
- (Choosing only 18+ keeps the app out of the Families programme, which it isn't designed
  for — it's a staff tool.)

## News app

**No.**

## Data safety

Answers in [data-safety.md](data-safety.md).

## Government app

**No.**

## Financial features

**My app doesn't provide any financial features.** It records bills and payments the business
received in cash/UPI/bank transfer, but doesn't move money, lend, trade, or hold funds —
none of Play's financial-feature categories apply.

## Health apps

**My app does not have any health features.**

## Store settings (Grow → Store presence → Store settings)

| Field | Value |
|---|---|
| App category | **Business** |
| Tags | Business management, Productivity (pick the closest available) |
| Email address (public) | deepomeshcreation@gmail.com |
| Phone (optional) | leave blank unless you want it public |
| Website (optional) | https://shreeram-dairy-milk.vercel.app |

## Countries / regions

**India** only, to start.

## Pricing

**Free.** (Changing a published app from free to paid later isn't allowed.)

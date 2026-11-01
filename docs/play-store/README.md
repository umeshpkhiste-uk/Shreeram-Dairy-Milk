# Google Play submission kit

Everything needed to list **Shreeram Doodh Diary & Sweets** (`com.shreeramdairy.dailymilk`) on
Google Play, except the app bundle (`.aab`), which is built last with
`eas build -p android --profile production` once development settles (see
[../android-release.md](../android-release.md) §6).

## Where everything lives

```
apps/mobile/fastlane/metadata/android/en-IN/      ← store listing (fastlane "supply" layout)
├── title.txt                     App name (≤30 chars)
├── short_description.txt         Short description (≤80)
├── full_description.txt          Full description (≤4000)
├── changelogs/default.txt        "What's new" release notes (≤500)
└── images/
    ├── icon.png                  512×512 app icon, full-bleed, no transparency
    ├── featureGraphic.png        1024×500 feature graphic
    └── phoneScreenshots/         ← TO DO: 2–8 real screenshots, see screenshots.md

docs/play-store/                                  ← Play Console form answers
├── README.md                     this checklist
├── privacy-policy.md             privacy policy text (live at /privacy on the website)
├── data-safety.md                Data safety form, question by question
├── content-rating.md             IARC questionnaire answers
├── app-content.md                ads, target audience, financial/health/news/gov, store settings
├── app-access.md                 reviewer login instructions
└── screenshots.md                shot list and capture steps

apps/web/src/app/(public)/privacy/          public privacy policy page   → /privacy
apps/web/src/app/(public)/delete-account/   public account deletion page → /delete-account
```

The listing folder uses fastlane's layout, so it can be uploaded either by copy-pasting into
Play Console or automatically later with `fastlane supply --skip_upload_aab`.

## Submission checklist

**Before anything else**
- [ ] Google Play developer account (one-time US$25) — personal or organisation
- [ ] Create app in Play Console: name `Shreeram Doodh Diary & Sweets`, default language
      **English (India) – en-IN**, App, Free
- [ ] Open https://shreeram-dairy-milk.vercel.app/privacy and `/delete-account` signed out —
      both must load without a login

**Store listing** (Grow → Store presence → Main store listing)
- [ ] App name ← `title.txt`
- [ ] Short description ← `short_description.txt`
- [ ] Full description ← `full_description.txt`
- [ ] App icon ← `images/icon.png`
- [ ] Feature graphic ← `images/featureGraphic.png`
- [ ] Phone screenshots ← `images/phoneScreenshots/` (**not captured yet** — screenshots.md)
- [ ] Store settings: category, contact email, website ← app-content.md

**App content** (Policy → App content)
- [ ] Privacy policy URL ← app-content.md
- [ ] App access ← app-access.md (create reviewer accounts first)
- [ ] Ads: No
- [ ] Content rating ← content-rating.md
- [ ] Target audience: 18+ only
- [ ] Data safety ← data-safety.md
- [ ] News / Government / Financial features / Health: No / No / None / None

**Release** (when the `.aab` is ready)
- [ ] `eas build -p android --profile production`
- [ ] Testing → **Internal testing** → create release → upload `.aab` → release notes ←
      `changelogs/default.txt` → add testers (staff Gmail addresses)
- [ ] Let EAS/Google manage the signing key (Play App Signing) — keep the upload key backed up
- [ ] New personal developer accounts must run a **closed test with at least 12 testers for
      14 days** before production access is granted — plan for this if the account is
      personal rather than an organisation
- [ ] Only then: Production → countries: India → roll out

## Facts these files rely on

If any of these change, update the listed files:

| Fact | Files |
|---|---|
| Package `com.shreeramdairy.dailymilk` (app.json) | this README |
| No ads, analytics, crash reporting, location, camera, contacts | data-safety.md, privacy-policy.md, app-content.md |
| Data hosted on Supabase (Seoul) and Vercel | privacy-policy.md, data-safety.md |
| Local data cleared on sign-out (`clearAllLocalData`) | privacy-policy.md |
| Contact email deepomeshcreation@gmail.com | app-content.md, privacy-policy.md, web pages |
| Worker tabs: Today's Route, Orders, History, Sync Status, Profile | app-access.md, screenshots.md |

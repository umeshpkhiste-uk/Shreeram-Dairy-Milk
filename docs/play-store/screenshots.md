# Phone screenshots — still to capture

The only listing asset not in the repo yet. They must come from the real app (Play policy
forbids screenshots that misrepresent it), so capture them once the UI has settled — same
reason the `.aab` isn't built yet.

## Where they go

`apps/mobile/fastlane/metadata/android/en-IN/images/phoneScreenshots/`, numbered in listing
order: `1_today-route.png`, `2_sync-status.png`, …

## Requirements (Play Console)

- **2 minimum, 8 maximum** (aim for 6).
- PNG or JPEG, **no transparency**, max 8 MB each.
- Each side 320–3840 px; aspect ratio between 9:16 and 16:9. Portrait from any modern Android
  phone (e.g. 1080 × 2400) is fine.
- To be eligible for Play's larger promotional placements, use at least 4 screenshots of
  1080 px or more on the short side.

## Shot list (use the reviewer/test accounts — never real customer names or numbers)

| # | Account | Screen | What should be visible |
|---|---|---|---|
| 1 | Worker | Today's Route | Route list with a mix of Delivered / Pending badges |
| 2 | Worker | Customer calendar | Month grid with today's delivery marked |
| 3 | Worker | Sync Status | "Today's deliveries" totals card |
| 4 | Admin | Dashboard | Today's metrics and the 2×2 quick actions |
| 5 | Admin | Deliveries | Daily report with filters |
| 6 | Admin | Bill detail | A monthly bill with items and a payment |

## How to capture

- **Real Android phone** (best): install the preview build
  (`eas build -p android --profile preview`), sign in, press Power + Volume-down.
- **Android emulator**: Android Studio → Device Manager → Pixel device → run the preview
  APK, then the camera button in the emulator toolbar.
- Turn on Do Not Disturb, full battery and a clean status bar before capturing.

Then drop the files in the folder above and tick this off in [README.md](README.md).

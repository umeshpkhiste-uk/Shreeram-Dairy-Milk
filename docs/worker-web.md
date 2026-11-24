# Stage 8 — Worker web app (PWA)

`apps/worker-web` is a Next.js app a delivery worker opens in **Chrome on Android** and adds to
the home screen. It is meant to replace the worker role of `apps/mobile`. It uses the same
Supabase project, RLS policies and `submit_delivery_event` RPC; no migration was needed. Other
browsers and iOS are out of scope.

A worker must be able to mark a delivery with zero network wait, and the mark must survive the
app closing before it syncs.

## Architecture

- **Local data** (`src/lib/db`): Dexie (IndexedDB), same tables as the mobile SQLite schema —
  `cached_customers`, `cached_milk_types`, `local_deliveries` (unique on customer + date),
  `sync_outbox`, `sync_meta` (the signed-in worker's profile and last sync time). Opened with
  strict durability, so a committed mark survives the phone dying. `navigator.storage.persist()`
  is requested at startup; Chrome decides (installing the app makes a grant likely), and a
  refusal is only logged.
- **Sync** (`src/lib/sync`): startup, foreground, connectivity restored, and manual. No
  Background Sync API.
- **Service worker**: Serwist precaches all static assets and the HTML of every screen except
  `/login`. There is no runtime caching, so Supabase responses are never stored in it. Built by
  `serwist build` after `next build` into `public/sw.js` (git-ignored).
- **Auth**: a Server Action signs in and calls `requireWorker()`. After that the screens trust
  the profile stored on the phone, so they open offline; each sync refreshes it and a
  deactivated worker is sent back to `/login`. RLS is the real boundary.

## Where this differs from the plan, and why

| Plan | Built | Why |
|---|---|---|
| `/today/[customerId]` | `/today/customer?id=` (history likewise) | A dynamic route can't be precached for every customer; a static page can. |
| `requireWorker()` in the layout | At sign-in, plus a check on every sync | A server-checked layout makes every screen dynamic, so it couldn't open offline. |
| Links between screens | Plain `<a>` | `<Link>` fetches from the server on tap, which fails or hangs with no signal. |
| Serwist via the webpack plugin | `@serwist/next/config` + `@serwist/cli` | Keeps Turbopack, same as `apps/web`. |
| Move delivery validation to `packages/shared` | Copied | `apps/mobile` can't import `packages/shared` — see `docs/web-admin.md`. |

## Where this differs from the mobile app, and why

Each is a way the ported code could lose or misfile a delivery, covered by
`src/lib/sync/sync-engine.test.ts` unless noted:

- **"No, not delivered" sends a reason.** The database requires one for anything but a completed
  delivery; the mobile app sends none, so the server rejects every missed mark.
- **A correction waits for its creation.** Sent first, it is permanently rejected.
- **An edit made during an upload is kept** — never shown as synced, never overwritten by the
  pull.
- **One sync at a time across tabs** (Web Locks); a sync requested during another runs after it.
- **Offline start with an expired session still works**; mobile's profile fetch fails and it
  shows sign-in (by design of the stored profile; not unit-tested).
- **A different worker can't take over a phone holding unsynced records** without agreeing to
  discard them (tested in the browser).
- **Sign-out needs a connection**, and clears local data only once the session has ended
  (tested in the browser while online).
- **The date is re-read when the app returns to the foreground** (not tested).

## Not included

- **Orders.** The mobile worker app has a read-only Orders tab; the plan's screen list does not.
  Workers relying on it can't fully switch until it is added.
- `apps/mobile`'s worker role is superseded but not deleted.

## Running and deploying

```bash
npm install                                        # repo root
cp apps/worker-web/.env.example apps/worker-web/.env.local   # same values as apps/web
npm run dev -w worker-web                          # http://localhost:3001, service worker off
npm run build -w worker-web && npm run start -w worker-web   # service worker on
```

Deploy as its own Vercel project with root directory `apps/worker-web` and the two
`NEXT_PUBLIC_*` variables. Not yet done; check that `/sw.js` is served after the first deploy,
since it is generated after `next build`.

## Verified

- `tsc`, `eslint`, build; unit tests 28/28. `packages/shared` 37/37, `apps/mobile` 88/88.
- Desktop Chrome, mobile viewport, production build, against a **local stub** of Supabase: with
  the app server stopped and the network cut, screens opened, a mark saved in 13 ms, records
  survived a reload; on reconnect a creation and its correction arrived in order as one
  version-2 row. Also wrong password, admin rejected, failed uploads retried, deactivation,
  account takeover refused, sign-out emptying every table.
- Lighthouse (snapshot, mobile) accessibility 100, best practices 100. This version has no PWA
  category; manifest, icons and an active service worker were checked by hand.

## Not verified — required before Stage 8 is done

1. **Live Supabase tests.** The project (`bdrtsrbmsoanrqjhesop`) was paused on 2026-11-24. With
   it running: a mark syncs through the real RPC, and a worker sees zero rows outside their own
   customers and deliveries.
2. **The Android pass**, on a real phone in Chrome, over HTTPS:
   1. Sign in, "Add to Home screen", open from the icon, wait for the route to load.
   2. Airplane mode on. Mark two customers delivered and one not delivered.
   3. Force-close and reopen from the icon, still in airplane mode. The marks are still there and
      Sync Status shows 3 pending.
   4. Restart the phone, reopen. Still 3 pending.
   5. Airplane mode off. Within seconds (or "Sync now") pending is 0 and the admin site shows
      all three.
   6. Leave it offline for over an hour, reopen: the route still opens and can be marked.
   7. Leave it open overnight: in the morning "today" is the new date.
   8. Try signing out with a pending mark: it warns first.

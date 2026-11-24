/// <reference lib="webworker" />
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Precache only — no runtime caching, so Supabase responses are never stored
// here. Delivery data lives in IndexedDB (src/lib/db).
new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    // /today/customer?id=… is one static page; the id is read in the browser.
    ignoreURLParametersMatching: [/^id$/],
  },
  skipWaiting: true,
  clientsClaim: true,
}).addEventListeners();

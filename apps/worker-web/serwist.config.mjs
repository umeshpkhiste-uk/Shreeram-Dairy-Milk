import { randomUUID } from "node:crypto";
import { globSync } from "node:fs";
import path from "node:path";

import { serwist } from "@serwist/next/config";

// Every worker screen, from source: on Vercel the prerendered HTML is moved
// out of .next before this runs, so precachePrerendered silently finds none.
// /login is left out — sign-in needs the network, and a stale copy would post
// to a Server Action id from an older build.
const screens = globSync("**/page.tsx", { cwd: "src/app/(worker)" }).map(
  (file) => `/${path.dirname(file)}`,
);
if (screens.length === 0) throw new Error("No worker screens found to precache");

const revision = randomUUID(); // new build, new HTML

// Runs after `next build` (see package.json).
export default serwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  precachePrerendered: false,
  additionalPrecacheEntries: screens.map((url) => ({ url, revision })),
});

import { serwist } from "@serwist/next/config";

// Runs after `next build` (see package.json) and precaches every static
// asset plus the prerendered HTML of each screen.
export default serwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // Sign-in always needs the network, and a stale copy would post to a Server
  // Action id from an older build.
  globIgnores: [".next/server/app/login.html"],
});

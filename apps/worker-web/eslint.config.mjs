import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Deliberate: <Link> fetches from the server on navigation, which fails
      // or hangs with no signal. A plain document load is answered by the
      // service worker's precache instead (docs/worker-web.md).
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/sw.js", "jest.config.js"]),
]);

export default eslintConfig;

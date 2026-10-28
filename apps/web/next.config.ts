import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // This is an admin-only app: every page reads the signed-in user's session
  // and queries Supabase with RLS applied to that user — nothing here is
  // safe to statically prerender or cache across users. Keep the simpler,
  // fully-dynamic rendering model instead of opting into Cache Components.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

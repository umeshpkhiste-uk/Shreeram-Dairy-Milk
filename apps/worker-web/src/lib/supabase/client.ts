import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@shreeram/shared';

import { env } from '@/lib/env';

const REQUEST_TIMEOUT_MS = 30_000;

/** Browser-side Supabase client — RLS-constrained anon key only. */
export const supabase = createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  global: {
    // On a connected-but-dead mobile network a request can hang for minutes,
    // which would hold the sync lock and block every later sync.
    fetch: (input, init) =>
      fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
  },
});

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@shreeram/shared';

import { env } from '@/lib/env';

/** Browser-side Supabase client (Client Components only) — same RLS-constrained anon key. */
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}

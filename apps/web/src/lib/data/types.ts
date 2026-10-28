import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@shreeram/shared';

/**
 * Every function in src/lib/data/* takes the request's own Supabase client
 * as its first argument rather than importing a module-level singleton (the
 * mobile app's pattern) — a Next.js server client is request-scoped (it
 * reads that request's cookies), so there is no safe global instance here.
 */
export type SupabaseServerClient = SupabaseClient<Database>;

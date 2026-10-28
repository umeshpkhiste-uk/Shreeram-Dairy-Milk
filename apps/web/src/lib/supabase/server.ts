import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@shreeram/shared';

import { env } from '@/lib/env';

/**
 * A Supabase client scoped to the signed-in user's own session (read from
 * cookies) — every query through this client is still subject to RLS. Never
 * a service-role client; this app has no privileged key at all. Create a
 * fresh one per request (Server Component / Server Action / Route Handler).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component that can't set cookies — the
          // middleware's session refresh already covers this request.
        }
      },
    },
  });
}

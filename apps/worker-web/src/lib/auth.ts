import type { SupabaseServerClient } from '@/lib/supabase/server';

import { isActiveWorker } from '@/lib/is-active-worker';
import type { Profile } from '@/lib/db/db';

/**
 * Worker counterpart of apps/web's `requireAdmin()`, called once at sign-in.
 * It can't sit in the layout: the worker screens are static so the service
 * worker can precache them, and must open with no network. RLS (every policy
 * checks `is_active_worker()`) is the real boundary on every later request,
 * and each sync re-checks the profile — see sync-engine.ts.
 */
export async function requireWorker(supabase: SupabaseServerClient): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  return profile && isActiveWorker(profile) ? profile : null;
}

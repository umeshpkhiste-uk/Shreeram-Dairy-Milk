import { redirect } from 'next/navigation';

import type { Database } from '@shreeram/shared';

import { createClient } from '@/lib/supabase/server';

type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * The real authorization boundary for this app's "admin-only" pages. The
 * proxy (src/proxy.ts) only checks "is there a session" as a UX convenience
 * — this checks the actual `profiles.role`/`is_active` via a query that is
 * itself subject to RLS, the same way `RouteGuard` + RLS work together in
 * the mobile app (apps/mobile/src/lib/auth/route-guard.tsx). Called from
 * `app/(admin)/layout.tsx` so every admin page is covered by one check.
 */
export async function requireAdmin(): Promise<{ profile: Profile }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (!profile || !profile.is_active || profile.role !== 'admin') {
    redirect('/login?error=not-authorized');
  }

  return { profile };
}

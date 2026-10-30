import { redirect } from 'next/navigation';

import type { Database } from '@shreeram/shared';

import type { SupabaseServerClient } from '@/lib/data/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * The real authorization boundary for this app's "admin-only" pages. The
 * proxy (src/proxy.ts) only checks "is there a session" as a UX convenience
 * — this checks the actual `profiles.role`/`is_active` via a query that is
 * itself subject to RLS, the same way `RouteGuard` + RLS work together in
 * the mobile app (apps/mobile/src/lib/auth/route-guard.tsx). Called from
 * `app/(admin)/layout.tsx` so every admin page is covered by one check.
 *
 * Takes an existing client (rather than creating its own) so the caller can
 * run this alongside other per-request queries with `Promise.all` instead of
 * stacking another sequential round trip in front of them.
 */
export async function requireAdmin(supabase: SupabaseServerClient): Promise<{ profile: Profile }> {
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

import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import { LoadingState } from '@/components/loading-state';
import { useAuth } from '@/lib/auth/auth-provider';
import type { UserRole } from '@/types/database';

/**
 * Guards a navigator (admin/worker tab group) so that authorization is
 * enforced in the client too, not only via RLS on the server. RLS is still
 * the actual security boundary — this only prevents a signed-in worker from
 * even seeing the admin tab bar, and vice versa.
 */
export function RouteGuard({ role, children }: { role: UserRole; children: ReactNode }) {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return <LoadingState label="Checking your session…" />;
  }

  if (auth.status === 'signedOut') {
    return <Redirect href="/sign-in" />;
  }

  if (!auth.profile.is_active) {
    return <Redirect href="/pending-activation" />;
  }

  if (auth.profile.role !== role) {
    return (
      <Redirect href={auth.profile.role === 'admin' ? '/(admin)/dashboard' : '/(worker)/today'} />
    );
  }

  return <>{children}</>;
}

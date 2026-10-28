import { Redirect } from 'expo-router';

import { LoadingState } from '@/components/loading-state';
import { useAuth } from '@/lib/auth/auth-provider';

/** Entry point: routes to sign-in, pending-activation, or the right navigator. */
export default function IndexScreen() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return <LoadingState label="Loading…" />;
  }

  if (auth.status === 'signedOut') {
    return <Redirect href="/sign-in" />;
  }

  if (!auth.profile.is_active) {
    return <Redirect href="/pending-activation" />;
  }

  return (
    <Redirect href={auth.profile.role === 'admin' ? '/(admin)/dashboard' : '/(worker)/today'} />
  );
}

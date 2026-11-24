import type { Profile } from '@/lib/db/db';

/** Same rule as the `public.is_active_worker()` SQL function. */
export function isActiveWorker(profile: Pick<Profile, 'role' | 'is_active'>): boolean {
  return profile.role === 'worker' && profile.is_active;
}

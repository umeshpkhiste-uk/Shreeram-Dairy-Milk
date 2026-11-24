'use server';

import { requireWorker } from '@/lib/auth';
import type { Profile } from '@/lib/db/db';
import { createClient } from '@/lib/supabase/server';

export async function signIn(
  email: string,
  password: string,
): Promise<{ error: string } | { profile: Profile }> {
  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const profile = await requireWorker(supabase);
  if (!profile) {
    await supabase.auth.signOut({ scope: 'local' });
    return { error: 'That account doesn’t have worker access. Contact the business owner.' };
  }
  return { profile };
}

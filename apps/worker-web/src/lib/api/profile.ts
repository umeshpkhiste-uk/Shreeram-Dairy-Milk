import type { Profile } from '@/lib/db/db';
import { supabase } from '@/lib/supabase/client';

export async function getOwnProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

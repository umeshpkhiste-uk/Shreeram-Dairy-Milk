'use server';

import { errorMessage } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';

import { dismissSyncFailure } from '@/lib/data/sync';
import { createClient } from '@/lib/supabase/server';

export async function dismissSyncFailureAction(eventId: string): Promise<{ error: string | null }> {
  try {
    await dismissSyncFailure(await createClient(), eventId);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to dismiss the record.') };
  }
  revalidatePath('/deliveries/sync');
  return { error: null };
}

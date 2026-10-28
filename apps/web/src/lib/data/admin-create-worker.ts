import type { SupabaseServerClient } from './types';

export type CreateWorkerInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  routeId?: string | null;
};

export type CreateWorkerResult = {
  id: string;
  email: string;
  fullName: string;
};

/**
 * Calls the admin-create-worker Edge Function (supabase/functions/admin-create-worker) —
 * the same one the mobile app calls (apps/mobile/src/lib/api/admin-create-worker.ts).
 * supabase-js attaches the caller's own session JWT automatically; the function
 * itself verifies the caller is an active admin before doing anything
 * privileged. The service-role key never reaches this app.
 */
export async function createWorkerAccount(
  supabase: SupabaseServerClient,
  input: CreateWorkerInput,
): Promise<CreateWorkerResult> {
  const { data, error } = await supabase.functions.invoke<CreateWorkerResult | { error: string }>(
    'admin-create-worker',
    { body: input },
  );

  if (error) {
    throw new Error(error.message);
  }
  if (data && 'error' in data) {
    throw new Error(data.error);
  }
  if (!data) {
    throw new Error('No response from server');
  }
  return data;
}

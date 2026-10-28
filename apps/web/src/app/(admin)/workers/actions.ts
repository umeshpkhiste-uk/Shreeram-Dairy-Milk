'use server';

import { revalidatePath } from 'next/cache';

import { createWorkerAccount } from '@/lib/data/admin-create-worker';
import { assignWorkerRoute, createRoute, setWorkerActive } from '@/lib/data/workers';
import { createClient } from '@/lib/supabase/server';

export type WorkerActionState = { error: string | null };

export async function createWorkerAction(
  _prevState: WorkerActionState,
  formData: FormData,
): Promise<WorkerActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const routeId = String(formData.get('routeId') ?? '') || null;

  if (!email || !password || !fullName) {
    return { error: 'Email, password, and full name are required.' };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const supabase = await createClient();
  try {
    await createWorkerAccount(supabase, {
      email,
      password,
      fullName,
      phone: phone || undefined,
      routeId,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create worker account.' };
  }

  revalidatePath('/workers');
  return { error: null };
}

export async function assignWorkerRouteAction(workerId: string, routeId: string | null) {
  const supabase = await createClient();
  await assignWorkerRoute(supabase, workerId, routeId);
  revalidatePath('/workers');
}

export async function setWorkerActiveAction(workerId: string, isActive: boolean) {
  const supabase = await createClient();
  await setWorkerActive(supabase, workerId, isActive);
  revalidatePath('/workers');
}

export type RouteActionState = { error: string | null };

export async function createRouteAction(
  _prevState: RouteActionState,
  formData: FormData,
): Promise<RouteActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!name) return { error: 'Enter a route name.' };

  const supabase = await createClient();
  try {
    await createRoute(supabase, { name, description: description || undefined });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create route.' };
  }
  revalidatePath('/workers');
  return { error: null };
}

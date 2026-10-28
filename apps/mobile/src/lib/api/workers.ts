import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

type WorkerRow = Database['public']['Tables']['workers']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type RouteRow = Database['public']['Tables']['routes']['Row'];

export type WorkerSummary = {
  id: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  route: Pick<RouteRow, 'id' | 'name'> | null;
};

/**
 * Joined client-side (workers + profiles + routes) rather than via a
 * PostgREST embedded select, since `workers.id` is a shared primary key /
 * foreign key to `profiles.id` rather than a conventionally-named foreign
 * key column — simple, predictable, and fine at this data scale (tens of
 * workers, not thousands).
 */
export async function listWorkers(): Promise<WorkerSummary[]> {
  const [{ data: workers, error: workersError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from('workers').select('*'),
      supabase.from('profiles').select('*').eq('role', 'worker'),
    ]);

  if (workersError) throw workersError;
  if (profilesError) throw profilesError;

  const routeIds = [...new Set((workers ?? []).map((w) => w.route_id).filter(Boolean))] as string[];
  let routesById = new Map<string, RouteRow>();
  if (routeIds.length > 0) {
    const { data: routes, error: routesError } = await supabase
      .from('routes')
      .select('*')
      .in('id', routeIds);
    if (routesError) throw routesError;
    routesById = new Map((routes ?? []).map((r) => [r.id, r]));
  }

  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (workers ?? [])
    .map((w): WorkerSummary | null => {
      const profile = profilesById.get(w.id);
      if (!profile) return null;
      return {
        id: w.id,
        fullName: profile.full_name,
        phone: profile.phone,
        isActive: profile.is_active,
        route: w.route_id ? (routesById.get(w.route_id) ?? null) : null,
      };
    })
    .filter((w): w is WorkerSummary => w !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function listRoutes(): Promise<RouteRow[]> {
  const { data, error } = await supabase.from('routes').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createRoute(input: {
  name: string;
  description?: string;
}): Promise<RouteRow> {
  const { data, error } = await supabase
    .from('routes')
    .insert({ name: input.name, description: input.description ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function assignWorkerRoute(workerId: string, routeId: string | null): Promise<void> {
  const { error } = await supabase.from('workers').update({ route_id: routeId }).eq('id', workerId);
  if (error) throw error;
}

export type { WorkerRow, ProfileRow };

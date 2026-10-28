import { Badge, Card, EmptyState, PageHeader, Table } from '@/components/ui';
import { listRoutes, listWorkers } from '@/lib/data/workers';
import { createClient } from '@/lib/supabase/server';

import { createRouteAction, createWorkerAction } from './actions';
import { NewRouteForm } from './new-route-form';
import { NewWorkerForm } from './new-worker-form';
import { WorkerRowActions } from './worker-row-actions';

export default async function WorkersPage() {
  const supabase = await createClient();
  const [workers, routes] = await Promise.all([listWorkers(supabase), listRoutes(supabase)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Workers & Routes" description={`${workers.length} worker account(s)`} />

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Add a worker</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Worker accounts can only be created here or from the mobile app by an admin — there is
          no public sign-up.
        </p>
        <NewWorkerForm routes={routes} action={createWorkerAction} />
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Routes</h2>
        <NewRouteForm action={createRouteAction} />
        {routes.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {routes.map((r) => (
              <li key={r.id}>
                <Badge label={r.name} tone="neutral" />
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Worker accounts</h2>
        {workers.length === 0 ? (
          <EmptyState title="No worker accounts yet" />
        ) : (
          <Table>
            <thead className="bg-surface-muted text-xs font-medium uppercase text-text-secondary">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Route / actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {workers.map((worker) => (
                <tr key={worker.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3 font-medium text-text">{worker.fullName}</td>
                  <td className="px-4 py-3 text-text-secondary">{worker.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge
                      label={worker.isActive ? 'Active' : 'Inactive'}
                      tone={worker.isActive ? 'success' : 'neutral'}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <WorkerRowActions worker={worker} routes={routes} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

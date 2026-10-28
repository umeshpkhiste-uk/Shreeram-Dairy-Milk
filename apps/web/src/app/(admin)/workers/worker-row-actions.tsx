'use client';

import { useTransition } from 'react';

import type { RouteRow, WorkerSummary } from '@/lib/data/workers';

import { assignWorkerRouteAction, setWorkerActiveAction } from './actions';

export function WorkerRowActions({ worker, routes }: { worker: WorkerSummary; routes: RouteRow[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={worker.route?.id ?? ''}
        disabled={pending}
        onChange={(e) =>
          startTransition(() => {
            void assignWorkerRouteAction(worker.id, e.target.value || null);
          })
        }
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-primary"
      >
        <option value="">Unassigned</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void setWorkerActiveAction(worker.id, !worker.isActive))}
        className="rounded-md border border-border px-3 py-1 text-sm font-medium text-text transition hover:bg-surface-muted disabled:opacity-60"
      >
        {worker.isActive ? 'Deactivate' : 'Reactivate'}
      </button>
    </div>
  );
}

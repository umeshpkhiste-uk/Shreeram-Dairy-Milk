'use client';

import { useState, useTransition } from 'react';

import { ErrorText, PrimaryButton, WarningButton } from '@/components/ui';
import type { RouteRow, WorkerSummary } from '@/lib/data/workers';

import { assignWorkerRouteAction, setWorkerActiveAction } from './actions';

export function WorkerRowActions({ worker, routes }: { worker: WorkerSummary; routes: RouteRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ToggleButton = worker.isActive ? WarningButton : PrimaryButton;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        defaultValue={worker.route?.id ?? ''}
        disabled={pending}
        onChange={(e) => {
          const select = e.currentTarget;
          startTransition(async () => {
            const result = await assignWorkerRouteAction(worker.id, select.value || null);
            setError(result.error);
            // Not saved: show the route the worker still has.
            if (result.error) select.value = worker.route?.id ?? '';
          });
        }}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-primary"
      >
        <option value="">Unassigned</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <ToggleButton
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError((await setWorkerActiveAction(worker.id, !worker.isActive)).error);
          })
        }
        className="ml-auto"
      >
        {worker.isActive ? 'Deactivate' : 'Reactivate'}
      </ToggleButton>
      {error ? <ErrorText message={error} /> : null}
    </div>
  );
}

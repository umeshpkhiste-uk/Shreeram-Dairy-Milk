'use client';

import { useActionState } from 'react';

import { ErrorText, PrimaryButton } from '@/components/ui';
import type { RouteRow } from '@/lib/data/workers';

import type { WorkerActionState } from './actions';

const inputClass =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary';
const labelClass = 'flex flex-col gap-1 text-sm font-medium text-text';

export function NewWorkerForm({
  routes,
  action,
}: {
  routes: RouteRow[];
  action: (state: WorkerActionState, formData: FormData) => Promise<WorkerActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Full name
          <input name="fullName" required className={inputClass} />
        </label>
        <label className={labelClass}>
          Phone (optional)
          <input name="phone" className={inputClass} />
        </label>
        <label className={labelClass}>
          Email
          <input name="email" type="email" required className={inputClass} />
        </label>
        <label className={labelClass}>
          Initial password
          <input name="password" type="password" required minLength={8} className={inputClass} />
        </label>
        <label className={labelClass}>
          Route (optional)
          <select name="routeId" defaultValue="" className={inputClass}>
            <option value="">Unassigned</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.error ? <ErrorText message={state.error} /> : null}
      <PrimaryButton type="submit" disabled={pending} className="self-start">
        {pending ? 'Creating…' : 'Create worker account'}
      </PrimaryButton>
    </form>
  );
}

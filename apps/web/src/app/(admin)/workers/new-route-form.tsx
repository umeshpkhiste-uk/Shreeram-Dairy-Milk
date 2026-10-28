'use client';

import { useActionState } from 'react';

import { ErrorText, SecondaryButton } from '@/components/ui';

import type { RouteActionState } from './actions';

export function NewRouteForm({
  action,
}: {
  action: (state: RouteActionState, formData: FormData) => Promise<RouteActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Route name
        <input
          name="name"
          required
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Description (optional)
        <input
          name="description"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>
      <SecondaryButton type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add route'}
      </SecondaryButton>
      {state.error ? <ErrorText message={state.error} /> : null}
    </form>
  );
}

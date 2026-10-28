'use client';

import { useActionState } from 'react';

import { ErrorText, SecondaryButton } from '@/components/ui';

import type { ActionState } from '../actions';

export function AdjustmentForm({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Amount (₹, negative = discount)
        <input
          name="amountRupees"
          required
          placeholder="-10 or 25.50"
          className="w-40 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Reason
        <input
          name="reason"
          required
          minLength={3}
          className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>
      <SecondaryButton type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add adjustment'}
      </SecondaryButton>
      {state.error ? <ErrorText message={state.error} /> : null}
    </form>
  );
}

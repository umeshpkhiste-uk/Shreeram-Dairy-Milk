'use client';

import { useActionState } from 'react';

import { ErrorText, SecondaryButton } from '@/components/ui';

import type { SettingsActionState } from './actions';

export function NewOrderItemForm({
  action,
}: {
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Name
        <input
          name="name"
          required
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Unit
        <select
          name="unit"
          required
          defaultValue="kg"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        >
          <option value="litre">Litre</option>
          <option value="kg">Kg</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Price per unit (₹)
        <input
          name="priceRupees"
          required
          placeholder="55.00"
          className="w-36 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>
      <SecondaryButton type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add item'}
      </SecondaryButton>
      {state.error ? <ErrorText message={state.error} /> : null}
    </form>
  );
}

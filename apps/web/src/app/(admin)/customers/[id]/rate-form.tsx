'use client';

import { useActionState } from 'react';

import { ErrorText, SecondaryButton } from '@/components/ui';
import type { MilkTypeRow } from '@/lib/data/milk-types';

import type { RateActionState } from './actions';

export function RateForm({
  milkTypes,
  action,
}: {
  milkTypes: MilkTypeRow[];
  action: (state: RateActionState, formData: FormData) => Promise<RateActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Milk type
        <select
          name="milkTypeId"
          required
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        >
          {milkTypes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Price per litre (₹)
        <input
          name="priceRupees"
          required
          placeholder="55.00"
          className="w-32 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Effective from
        <input
          name="effectiveFrom"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>
      <SecondaryButton type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Set rate'}
      </SecondaryButton>
      {state.error ? <ErrorText message={state.error} /> : null}
    </form>
  );
}

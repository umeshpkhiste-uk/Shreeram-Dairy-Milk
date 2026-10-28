'use client';

import { useActionState, useTransition } from 'react';

import { formatPaiseAsRupees } from '@shreeram/shared';

import { Badge, ErrorText, SecondaryButton } from '@/components/ui';
import type { MilkTypeRow } from '@/lib/data/milk-types';

import { toggleMilkTypeActiveAction, updateMilkTypePriceAction } from './actions';

export function MilkTypeRowItem({ milkType }: { milkType: MilkTypeRow }) {
  const boundUpdatePrice = updateMilkTypePriceAction.bind(null, milkType.id);
  const [state, formAction, pending] = useActionState(boundUpdatePrice, { error: null });
  const [togglePending, startTransition] = useTransition();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-2">
        <span className="font-medium text-text">{milkType.name}</span>
        <Badge label={milkType.is_active ? 'Active' : 'Inactive'} tone={milkType.is_active ? 'success' : 'neutral'} />
        <span className="text-sm text-text-secondary">
          Current: {formatPaiseAsRupees(milkType.default_price_paise)}/L
        </span>
      </div>
      <div className="flex items-center gap-2">
        <form action={formAction} className="flex items-center gap-2">
          <input
            name="priceRupees"
            placeholder="New price (₹/L)"
            className="w-36 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-primary"
          />
          <SecondaryButton type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Update price'}
          </SecondaryButton>
        </form>
        <SecondaryButton
          type="button"
          disabled={togglePending}
          onClick={() =>
            startTransition(() => void toggleMilkTypeActiveAction(milkType.id, !milkType.is_active))
          }
        >
          {milkType.is_active ? 'Deactivate' : 'Reactivate'}
        </SecondaryButton>
      </div>
      {state.error ? <ErrorText message={state.error} /> : null}
    </li>
  );
}

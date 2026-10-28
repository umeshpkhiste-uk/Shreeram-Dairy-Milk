'use client';

import { useActionState, useTransition } from 'react';

import { formatPaiseAsRupees } from '@shreeram/shared';

import { Badge, ErrorText, SecondaryButton } from '@/components/ui';
import type { ProductRow } from '@/lib/data/products';

import { toggleOrderItemActiveAction, updateOrderItemPriceAction } from './actions';

export function OrderItemRow({ product }: { product: ProductRow }) {
  const boundUpdatePrice = updateOrderItemPriceAction.bind(null, product.id);
  const [state, formAction, pending] = useActionState(boundUpdatePrice, { error: null });
  const [togglePending, startTransition] = useTransition();

  const unitLabel = product.unit === 'litre' ? 'L' : 'Kg';

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-2">
        <span className="font-medium text-text">
          {product.name} ({unitLabel})
        </span>
        <Badge label={product.is_active ? 'Active' : 'Inactive'} tone={product.is_active ? 'success' : 'neutral'} />
        <span className="text-sm text-text-secondary">
          Current: {formatPaiseAsRupees(product.price_paise)}/{unitLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <form action={formAction} className="flex items-center gap-2">
          <input
            name="priceRupees"
            placeholder={`Item New Price (₹/${unitLabel})`}
            className="w-44 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-primary"
          />
          <SecondaryButton type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Update price'}
          </SecondaryButton>
        </form>
        <SecondaryButton
          type="button"
          disabled={togglePending}
          onClick={() =>
            startTransition(() => void toggleOrderItemActiveAction(product.id, !product.is_active))
          }
        >
          {product.is_active ? 'Deactivate' : 'Reactivate'}
        </SecondaryButton>
      </div>
      {state.error ? <ErrorText message={state.error} /> : null}
    </li>
  );
}

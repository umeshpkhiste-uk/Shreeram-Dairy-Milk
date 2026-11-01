'use client';

import { useActionState, useState, useTransition } from 'react';

import { formatPaiseAsRupees } from '@shreeram/shared';

import { Badge, DangerButton, ErrorText, SecondaryButton } from '@/components/ui';
import type { ProductRow } from '@/lib/data/products';

import { deleteOrderItemAction, updateOrderItemPriceAction, type DeleteOrderItemState } from './actions';

export function OrderItemRow({ product }: { product: ProductRow }) {
  const boundUpdatePrice = updateOrderItemPriceAction.bind(null, product.id);
  const [state, formAction, pending] = useActionState(boundUpdatePrice, { error: null });
  const [deletePending, startTransition] = useTransition();
  const [deleteResult, setDeleteResult] = useState<DeleteOrderItemState | null>(null);
  // An inline confirm instead of window.confirm — a native confirm() dialog
  // blocks the main thread for however long the admin takes to respond,
  // which shows up as a multi-second "blocked UI" / bad-INP warning even
  // though the actual delete is instant.
  const [confirming, setConfirming] = useState(false);

  function handleConfirmDelete() {
    setConfirming(false);
    startTransition(async () => {
      setDeleteResult(await deleteOrderItemAction(product.id));
    });
  }

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
        {confirming ? (
          <>
            <span className="text-sm text-text-secondary">
              Delete &ldquo;{product.name}&rdquo;? This permanently removes it from the database.
            </span>
            <DangerButton type="button" disabled={deletePending} onClick={handleConfirmDelete}>
              {deletePending ? 'Deleting…' : 'Yes, delete'}
            </DangerButton>
            <SecondaryButton type="button" disabled={deletePending} onClick={() => setConfirming(false)}>
              Cancel
            </SecondaryButton>
          </>
        ) : (
          <SecondaryButton type="button" onClick={() => setConfirming(true)}>
            Delete
          </SecondaryButton>
        )}
      </div>
      {state.error ? <ErrorText message={state.error} /> : null}
      {deleteResult?.error ? <ErrorText message={deleteResult.error} /> : null}
    </li>
  );
}

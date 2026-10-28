'use client';

import { useActionState } from 'react';

import { ErrorText, PrimaryButton } from '@/components/ui';

import { updateOrderItemsAction, type ActionState } from './actions';

type Product = { id: string; name: string; unit: 'litre' | 'kg' };

/** Opened by "Update the order" — prefilled with the order's current quantities, editable. */
export function OrderItemsEditor({
  orderId,
  products,
  initialQuantitiesBaseUnit,
  onDone,
}: {
  orderId: string;
  products: Product[];
  initialQuantitiesBaseUnit: Record<string, number>;
  onDone: () => void;
}) {
  const boundAction = updateOrderItemsAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, {
    error: null,
  });

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-surface-muted p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {products.map((p) => {
          const baseQty = initialQuantitiesBaseUnit[p.id];
          const defaultValue = baseQty ? String(baseQty / 1000) : '';
          return (
            <label key={p.id} className="flex items-center justify-between gap-2 text-sm text-text">
              <span>
                {p.name} ({p.unit === 'litre' ? 'L' : 'Kg'})
              </span>
              <input
                type="text"
                inputMode="decimal"
                name={`quantity_${p.id}`}
                defaultValue={defaultValue}
                placeholder="0"
                className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-primary"
              />
            </label>
          );
        })}
      </div>
      {state.error ? <ErrorText message={state.error} /> : null}
      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </PrimaryButton>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface"
        >
          Close
        </button>
      </div>
    </form>
  );
}

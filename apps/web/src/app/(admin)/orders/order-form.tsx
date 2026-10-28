'use client';

import { useActionState } from 'react';

import { formatPaiseAsRupees, todayInBusinessTimezone } from '@shreeram/shared';

import { ErrorText, PrimaryButton } from '@/components/ui';

import { createOrderAction, type ActionState } from './actions';

type SelectOption = { id: string; label: string };

export function OrderForm({
  customers,
  workers,
  products,
}: {
  customers: SelectOption[];
  workers: SelectOption[];
  products: { id: string; name: string; unit: 'litre' | 'kg'; price_paise: number }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createOrderAction, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-text">
          Customer
          <select
            name="customerId"
            required
            defaultValue=""
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
          >
            <option value="" disabled>
              Select customer
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-text">
          Worker (delivers this order)
          <select
            name="workerId"
            required
            defaultValue=""
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
          >
            <option value="" disabled>
              Select worker
            </option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-text">
          Date
          <input
            type="date"
            name="orderDate"
            required
            defaultValue={todayInBusinessTimezone()}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
          />
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-text">Items</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-surface-muted text-xs font-medium uppercase text-text-secondary">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Quantity ({'litre: L, kg: Kg'})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {formatPaiseAsRupees(p.price_paise)}/{p.unit === 'litre' ? 'L' : 'Kg'}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      name={`quantity_${p.id}`}
                      placeholder={`0 ${p.unit === 'litre' ? 'L' : 'Kg'}`}
                      className="w-28 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-primary"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Notes (optional)
        <textarea
          name="notes"
          rows={2}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>

      {state.error ? <ErrorText message={state.error} /> : null}

      <div>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? 'Placing order…' : 'Place order'}
        </PrimaryButton>
      </div>
    </form>
  );
}

'use client';

import { unitLabel, type CustomerProduct } from '@shreeram/shared';
import { useState } from 'react';

import { DangerButton, InfoButton } from '@/components/ui';
import type { MilkTypeRow } from '@/lib/data/milk-types';

const inputClass =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary';
const labelClass = 'flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-text';

type ProductRow = { key: number; product?: CustomerProduct };

/** One row per product; the action reads the repeated field names in order. */
export function ProductFields({
  products,
  milkTypes,
}: {
  products: CustomerProduct[];
  milkTypes: MilkTypeRow[];
}) {
  const [rows, setRows] = useState<ProductRow[]>(() =>
    products.length > 0
      ? products.map((product, key) => ({ key, product }))
      : [{ key: 0 }],
  );

  return (
    <fieldset className="rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-medium text-text">Products</legend>
      <div className="flex flex-col gap-3">
        {rows.map(({ key, product }, index) => (
          <div key={key} className="flex flex-wrap items-end gap-3">
            <label className={labelClass}>
              Product type
              <select
                name="milkTypeId"
                required
                defaultValue={product?.milkTypeId ?? ''}
                className={inputClass}
              >
                <option value="" disabled>
                  Select a product type
                </option>
                {milkTypes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({unitLabel(m.unit)})
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Daily quantity (ml or grams)
              <input
                name="dailyQuantity"
                type="number"
                min={1}
                required
                defaultValue={product?.quantity}
                className={inputClass}
              />
            </label>
            {rows.length > 1 ? (
              <DangerButton
                type="button"
                aria-label={`Remove product ${index + 1}`}
                onClick={() => setRows(rows.filter((row) => row.key !== key))}
              >
                Remove
              </DangerButton>
            ) : null}
          </div>
        ))}
      </div>
      {rows.length < milkTypes.length ? (
        <InfoButton
          type="button"
          className="mt-3"
          onClick={() => setRows([...rows, { key: Math.max(...rows.map((r) => r.key)) + 1 }])}
        >
          Add product
        </InfoButton>
      ) : null}
    </fieldset>
  );
}

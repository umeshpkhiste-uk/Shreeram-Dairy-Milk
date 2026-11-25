// Copy of the formatters in packages/shared/src/lib/quantity.ts — keep in sync.
import type { ProductUnit } from '@/types/database';

const UNITS = {
  litre: { small: 'ml', large: 'L' },
  kg: { small: 'g', large: 'Kg' },
};

/** Litre is the unit when none is known, e.g. a phone's cache saved before products had units. */
export function unitLabel(unit: ProductUnit | undefined): string {
  return UNITS[unit ?? 'litre'].large;
}

/** 500 → "500 ml" or "500 g". */
export function formatQuantity(quantity: number, unit: ProductUnit | undefined): string {
  return `${quantity} ${UNITS[unit ?? 'litre'].small}`;
}

/** Totals in L and Kg, never added together: "12.50 L + 0.50 Kg". */
export function formatQuantityTotal(
  items: { quantity: number; unit: ProductUnit | undefined }[],
): string {
  const totals: Partial<Record<ProductUnit, number>> = {};
  for (const { quantity, unit = 'litre' } of items) {
    totals[unit] = (totals[unit] ?? 0) + quantity;
  }
  const parts = (['litre', 'kg'] as const)
    .filter((unit) => totals[unit])
    .map((unit) => `${((totals[unit] ?? 0) / 1000).toFixed(2)} ${UNITS[unit].large}`);
  return parts.join(' + ') || '0.00 L';
}

import type { ProductUnit } from '../types/database';

/**
 * Order/delivery quantities are always stored as an integer base unit
 * (millilitres for litre-priced products, grams for kg-priced products) —
 * never floating point. This is the only place a user-typed decimal (e.g.
 * "1.5" litres) is converted to that integer, so rounding stays consistent.
 */
export function parseQuantityToBaseUnit(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) {
    return null;
  }
  const value = Math.round(Number(trimmed) * 1000);
  return value > 0 ? value : null;
}

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

/** A third decimal only when there is one, so quantity × rate is the amount on a bill. */
function largeQuantity(base: number): string {
  return (base / 1000).toFixed(base % 10 === 0 ? 2 : 3);
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
    .map((unit) => `${largeQuantity(totals[unit] ?? 0)} ${UNITS[unit].large}`);
  return parts.join(' + ') || '0.00 L';
}

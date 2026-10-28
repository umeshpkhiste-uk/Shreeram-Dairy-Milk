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

import { formatQuantity, formatQuantityTotal, unitLabel } from './quantity';

describe('product quantities', () => {
  it('uses the small and large unit of the product', () => {
    expect(formatQuantity(500, 'litre')).toBe('500 ml');
    expect(formatQuantity(500, 'kg')).toBe('500 g');
    expect(unitLabel('litre')).toBe('L');
    expect(unitLabel('kg')).toBe('Kg');
  });

  it('falls back to litre when the unit is not known', () => {
    expect(formatQuantity(500, undefined)).toBe('500 ml');
  });

  it('never adds litres and kilos together', () => {
    expect(
      formatQuantityTotal([
        { quantity: 500, unit: 'kg' },
        { quantity: 1500, unit: 'litre' },
        { quantity: 1000, unit: undefined },
      ]),
    ).toBe('2.50 L + 0.50 Kg');
    expect(formatQuantityTotal([{ quantity: 250, unit: 'kg' }])).toBe('0.25 Kg');
    expect(formatQuantityTotal([])).toBe('0.00 L');
  });
});

import { deliveryEntrySchema } from './delivery';

describe('deliveryEntrySchema', () => {
  it('accepts a completed delivery with no reason', () => {
    const result = deliveryEntrySchema.safeParse({
      status: 'completed',
      deliveredQuantityMl: 1000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a partial delivery with no reason', () => {
    const result = deliveryEntrySchema.safeParse({
      status: 'partial',
      deliveredQuantityMl: 500,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a missed delivery with a reason', () => {
    const result = deliveryEntrySchema.safeParse({
      status: 'missed',
      deliveredQuantityMl: 0,
      reason: 'Customer not home',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative quantity', () => {
    const result = deliveryEntrySchema.safeParse({
      status: 'completed',
      deliveredQuantityMl: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer quantity', () => {
    const result = deliveryEntrySchema.safeParse({
      status: 'completed',
      deliveredQuantityMl: 500.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown status', () => {
    const result = deliveryEntrySchema.safeParse({
      status: 'delivered',
      deliveredQuantityMl: 500,
    });
    expect(result.success).toBe(false);
  });
});

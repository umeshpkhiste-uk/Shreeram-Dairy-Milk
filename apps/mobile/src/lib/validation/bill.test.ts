import { billAdjustmentSchema } from './bill';

describe('billAdjustmentSchema', () => {
  it('accepts a positive charge with a reason', () => {
    expect(billAdjustmentSchema.safeParse({ amountRupees: '50', reason: 'late fee' }).success).toBe(
      true,
    );
  });

  it('accepts a negative discount', () => {
    expect(
      billAdjustmentSchema.safeParse({ amountRupees: '-50.25', reason: 'loyalty discount' })
        .success,
    ).toBe(true);
  });

  it('rejects a missing or too-short reason', () => {
    expect(billAdjustmentSchema.safeParse({ amountRupees: '50', reason: '' }).success).toBe(false);
    expect(billAdjustmentSchema.safeParse({ amountRupees: '50', reason: 'ab' }).success).toBe(
      false,
    );
  });

  it('rejects a non-numeric amount', () => {
    expect(
      billAdjustmentSchema.safeParse({ amountRupees: 'fifty', reason: 'late fee' }).success,
    ).toBe(false);
  });
});

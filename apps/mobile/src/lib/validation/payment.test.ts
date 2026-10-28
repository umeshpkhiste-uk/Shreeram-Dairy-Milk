import { paymentFormSchema } from './payment';

const BASE = {
  amountRupees: '100',
  method: 'cash' as const,
  transactionReference: '',
  paymentDate: '2026-01-15',
};

describe('paymentFormSchema', () => {
  it('accepts a valid cash payment with no reference', () => {
    expect(paymentFormSchema.safeParse(BASE).success).toBe(true);
  });

  it('accepts a valid UPI payment with a reference', () => {
    expect(
      paymentFormSchema.safeParse({ ...BASE, method: 'upi', transactionReference: 'UPI-1' })
        .success,
    ).toBe(true);
  });

  it('rejects a zero or negative amount', () => {
    expect(paymentFormSchema.safeParse({ ...BASE, amountRupees: '0' }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...BASE, amountRupees: '-5' }).success).toBe(false);
  });

  it('rejects a malformed payment date', () => {
    expect(paymentFormSchema.safeParse({ ...BASE, paymentDate: '15/01/2026' }).success).toBe(false);
  });

  it('rejects an unknown payment method', () => {
    expect(paymentFormSchema.safeParse({ ...BASE, method: 'cheque' }).success).toBe(false);
  });
});

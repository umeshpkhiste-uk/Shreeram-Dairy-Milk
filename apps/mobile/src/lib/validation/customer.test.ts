import { customerFormSchema } from './customer';

const validInput = {
  fullName: 'Ramesh Kumar',
  mobileNumber: '9876543210',
  address: '12 MG Road, Pune',
  defaultDailyQuantityMl: 500,
  milkTypeId: '11111111-1111-4111-8111-111111111111',
  deliveryStartDate: '2026-01-01',
};

describe('customerFormSchema', () => {
  it('accepts a valid customer', () => {
    const result = customerFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects a mobile number that is too short', () => {
    const result = customerFormSchema.safeParse({ ...validInput, mobileNumber: '12345' });
    expect(result.success).toBe(false);
  });

  it('accepts a mobile number with a country code', () => {
    const result = customerFormSchema.safeParse({ ...validInput, mobileNumber: '+919876543210' });
    expect(result.success).toBe(true);
  });

  it('rejects a zero or negative daily quantity', () => {
    const result = customerFormSchema.safeParse({ ...validInput, defaultDailyQuantityMl: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer daily quantity (no fractional millilitres)', () => {
    const result = customerFormSchema.safeParse({ ...validInput, defaultDailyQuantityMl: 499.5 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing full name', () => {
    const result = customerFormSchema.safeParse({ ...validInput, fullName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email when one is provided', () => {
    const result = customerFormSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('allows an empty email (optional field)', () => {
    const result = customerFormSchema.safeParse({ ...validInput, email: '' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid milk type id', () => {
    const result = customerFormSchema.safeParse({ ...validInput, milkTypeId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

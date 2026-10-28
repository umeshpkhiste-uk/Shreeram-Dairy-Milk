import { paymentOutcomeStatus } from './status';

describe('paymentOutcomeStatus', () => {
  it('leaves draft and voided unchanged, regardless of payments', () => {
    expect(paymentOutcomeStatus('draft', 1000, 1000)).toBe('draft');
    expect(paymentOutcomeStatus('voided', 1000, 1000)).toBe('voided');
  });

  it('stays finalized with zero payments', () => {
    expect(paymentOutcomeStatus('finalized', 1000, 0)).toBe('finalized');
  });

  it('becomes partially_paid with a non-zero payment below the total', () => {
    expect(paymentOutcomeStatus('finalized', 1000, 1)).toBe('partially_paid');
    expect(paymentOutcomeStatus('finalized', 1000, 999)).toBe('partially_paid');
  });

  it('becomes paid exactly at the total payable (boundary)', () => {
    expect(paymentOutcomeStatus('finalized', 1000, 1000)).toBe('paid');
  });

  it('becomes paid when overpaid', () => {
    expect(paymentOutcomeStatus('partially_paid', 1000, 1500)).toBe('paid');
  });

  it('treats a non-positive total payable as already paid once anything is recorded', () => {
    expect(paymentOutcomeStatus('finalized', 0, 0)).toBe('paid');
    expect(paymentOutcomeStatus('finalized', -500, 0)).toBe('paid');
  });
});

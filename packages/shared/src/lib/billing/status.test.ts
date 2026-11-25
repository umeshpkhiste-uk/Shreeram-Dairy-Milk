import { billAmountDue } from './status';

describe('billAmountDue', () => {
  it('is the unpaid rest while a bill is not paid', () => {
    expect(billAmountDue('partially_paid', 1000, 400)).toEqual({ duePaise: 600, settledElsewherePaise: 0 });
  });

  it('is nothing for a paid bill whose money was recorded on another bill', () => {
    expect(billAmountDue('paid', 7800, 0)).toEqual({ duePaise: 0, settledElsewherePaise: 7800 });
  });

  it('keeps the credit of an overpaid bill', () => {
    expect(billAmountDue('paid', 1000, 1500)).toEqual({ duePaise: -500, settledElsewherePaise: 0 });
  });
});

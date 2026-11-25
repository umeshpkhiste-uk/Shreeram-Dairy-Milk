import type { BillPdfData } from '../pdf/bill-template';
import { billMessage, whatsappNumber } from './whatsapp';

const DATA: BillPdfData = {
  business: { businessName: 'Dairy', contactPhone: null, contactEmail: null, address: null, upiId: null },
  customer: { fullName: 'Asha', address: 'x', mobileNumber: '9000000001', accountReference: null },
  bill: {
    billNumber: 'SDDS-1126-0002',
    billingMonth: '2026-11-01',
    billedThrough: '2026-11-25',
    status: 'partially_paid',
    previousOutstandingBalancePaise: 0,
    subtotalPaise: 15600,
    adjustmentsTotalPaise: 0,
    totalPayablePaise: 15600,
  },
  includedIn: null,
  paymentClaimed: false,
  noDeliveryDays: 1,
  items: ['2026-11-01', '2026-11-02'].map((deliveryDate) => ({
    deliveryDate,
    milkTypeName: 'Cow Milk',
    quantityMl: 1000,
    unit: 'litre' as const,
    pricePaise: 7800,
    amountPaise: 7800,
  })),
  adjustments: [],
  payments: [
    { paymentDate: '2026-11-20', amountPaise: 5600, method: 'cash', transactionReference: null },
  ],
};

describe('whatsappNumber', () => {
  it.each([
    ['9876543210', '919876543210'],
    ['09876543210', '919876543210'],
    ['+919876543210', '919876543210'],
    ['919876543210', '919876543210'],
  ])('%s -> %s', (phone, expected) => {
    expect(whatsappNumber(phone)).toBe(expected);
  });
});

describe('billMessage', () => {
  it('lists days, money and the link, leaving out zero amounts', () => {
    const message = billMessage(DATA, 'https://example.com/bill/1');
    expect(message).toContain('November 2026 (till 25 Nov)');
    expect(message).toContain('Cow Milk: 2 days, 2.00 L x ₹78.00/L = ₹156.00');
    expect(message).toContain('No delivery (you informed us): 1 day\n');
    expect(message).toContain('*Total Amount to be Paid: ₹100.00*');
    expect(message).toContain('https://example.com/bill/1');
    expect(message).not.toContain('included in');
    expect(billMessage({ ...DATA, includedIn: 'SDDS-1226-0001' }, 'x')).toContain(
      'included in bill SDDS-1226-0001',
    );
    expect(message).not.toContain('Previous balance');
    expect(message).not.toContain('Settled');
  });
});

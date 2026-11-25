import { groupBillItems, renderBillBodyHtml, type BillPdfData } from './bill-template';

const BASE: BillPdfData = {
  business: {
    businessName: 'Shreeram Daily Milk',
    contactPhone: '+919000000000',
    contactEmail: 'hello@shreeram.example',
    address: '1 Dairy Road',
    upiId: 'dairy@upi',
  },
  customer: {
    fullName: 'Asha Patel',
    address: '2 Customer Lane',
    mobileNumber: '+919000000001',
    accountReference: 'ACC-001',
  },
  bill: {
    billNumber: 'SDM-000042',
    billingMonth: '2026-01-01',
    billedThrough: '2026-01-31',
    status: 'finalized',
    previousOutstandingBalancePaise: 0,
    subtotalPaise: 17600,
    adjustmentsTotalPaise: -1000,
    totalPayablePaise: 16600,
  },
  includedIn: null,
  paymentClaimed: false,
  noDeliveryDays: 2,
  items: [
    {
      deliveryDate: '2026-01-01',
      milkTypeName: 'Cow Milk',
      quantityMl: 500,
      unit: 'litre',
      pricePaise: 5500,
      amountPaise: 2750,
    },
  ],
  adjustments: [{ reason: 'loyalty discount', amountPaise: -1000 }],
  payments: [
    { paymentDate: '2026-02-01', amountPaise: 10000, method: 'cash', transactionReference: null },
  ],
};

describe('renderBillBodyHtml', () => {
  it('shows a kg product in Kg and per Kg', () => {
    const html = renderBillBodyHtml({
      ...BASE,
      items: [{ ...BASE.items[0], milkTypeName: 'Paneer', quantityMl: 500, unit: 'kg' }],
    });
    expect(html).toContain('0.50 Kg<');
    expect(html).toContain('/Kg<');
    expect(html).not.toContain('0.50 L');
  });

  it('includes the business name, customer name, and bill number', () => {
    const html = renderBillBodyHtml(BASE);
    expect(html).toContain('Shreeram Daily Milk');
    expect(html).toContain('Asha Patel');
    expect(html).toContain('SDM-000042');
  });

  it('includes each delivery line item and the total payable', () => {
    const html = renderBillBodyHtml(BASE);
    expect(html).toContain('Cow Milk');
    expect(html).toContain('0.50 L');
    expect(html).toContain('₹27.50');
  });

  it('has one line per product and rate, with its days', () => {
    const [item] = BASE.items;
    const lines = groupBillItems([
      item,
      { ...item, deliveryDate: '2026-01-02' },
      { ...item, deliveryDate: '2026-01-03', pricePaise: 6000, amountPaise: 3000 },
      { ...item, milkTypeName: 'Curd' },
    ]);
    expect(lines.map((l) => [l.milkTypeName, l.days, l.quantityMl, l.amountPaise])).toEqual([
      ['Cow Milk', 2, 1000, 5500],
      ['Cow Milk', 1, 500, 3000],
      ['Curd', 1, 500, 2750],
    ]);
  });

  it('shows the no-delivery days, and the date only when the month is not over', () => {
    expect(renderBillBodyHtml(BASE)).toContain('no delivery: 2');
    expect(renderBillBodyHtml(BASE)).not.toContain('till');
    const early = { ...BASE, bill: { ...BASE.bill, billedThrough: '2026-01-25' } };
    expect(renderBillBodyHtml(early)).toContain('January 2026 (till 25 Jan)');
  });

  it('labels the customer and says where to pay, when that is set', () => {
    const html = renderBillBodyHtml(BASE);
    for (const text of [
      'Bill For: Asha Patel',
      'Address: 2 Customer Lane',
      'Contact: +919000000001',
      'Payment method:',
      'Pay to: <a href="upi://pay?pa=dairy@upi&amp;pn=Shreeram%20Daily%20Milk&amp;am=66.00&amp;cu=INR&amp;tn=Bill%20SDM-000042">+919000000000</a>',
      '>dairy@upi</a>',
    ]) {
      expect(html).toContain(text);
    }
    const unset = { ...BASE, business: { ...BASE.business, contactPhone: null, upiId: null } };
    expect(renderBillBodyHtml(unset)).not.toContain('Payment method');
    expect(html).not.toContain('ACC-001');
    const noUpi = { ...BASE, business: { ...BASE.business, upiId: null } };
    expect(renderBillBodyHtml(noUpi)).toContain('Pay to: +919000000000<');
    const paid = { ...BASE, bill: { ...BASE.bill, status: 'paid' as const } };
    expect(renderBillBodyHtml(paid)).not.toContain('&amp;am=');
  });

  it('sends the customer to the newer bill that already has this amount', () => {
    const html = renderBillBodyHtml({ ...BASE, includedIn: 'SDM-000043' });
    expect(html).toContain('already included in bill SDM-000043');
    expect(html).not.toContain('upi://');
    expect(renderBillBodyHtml(BASE)).not.toContain('already included');
  });

  it('escapes HTML-significant characters in free-text fields', () => {
    const html = renderBillBodyHtml({
      ...BASE,
      customer: { ...BASE.customer, fullName: '<script>alert(1)</script>' },
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows a fallback row when there are no billable deliveries', () => {
    const html = renderBillBodyHtml({ ...BASE, items: [] });
    expect(html).toContain('No billable deliveries this period.');
  });
});

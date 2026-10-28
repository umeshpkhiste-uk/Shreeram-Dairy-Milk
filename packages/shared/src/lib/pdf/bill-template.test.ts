import { renderBillBodyHtml, renderBillHtml, type BillPdfData } from './bill-template';

const BASE: BillPdfData = {
  business: {
    businessName: 'Shreeram Daily Milk',
    contactPhone: '+919000000000',
    contactEmail: 'hello@shreeram.example',
    address: '1 Dairy Road',
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
    status: 'finalized',
    previousOutstandingBalancePaise: 0,
    subtotalPaise: 17600,
    adjustmentsTotalPaise: -1000,
    totalPayablePaise: 16600,
  },
  items: [
    {
      deliveryDate: '2026-01-01',
      milkTypeName: 'Cow Milk',
      quantityMl: 500,
      pricePaise: 5500,
      amountPaise: 2750,
    },
  ],
  adjustments: [{ reason: 'loyalty discount', amountPaise: -1000 }],
  payments: [
    { paymentDate: '2026-02-01', amountPaise: 10000, method: 'cash', transactionReference: null },
  ],
};

describe('renderBillHtml', () => {
  it('includes the business name, customer name, and bill number', () => {
    const html = renderBillHtml(BASE);
    expect(html).toContain('Shreeram Daily Milk');
    expect(html).toContain('Asha Patel');
    expect(html).toContain('SDM-000042');
  });

  it('includes each delivery line item and the total payable', () => {
    const html = renderBillHtml(BASE);
    expect(html).toContain('Cow Milk');
    expect(html).toContain('500 ml');
    expect(html).toContain('₹27.50');
  });

  it('escapes HTML-significant characters in free-text fields', () => {
    const html = renderBillHtml({
      ...BASE,
      customer: { ...BASE.customer, fullName: '<script>alert(1)</script>' },
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows a fallback row when there are no billable deliveries', () => {
    const html = renderBillHtml({ ...BASE, items: [] });
    expect(html).toContain('No billable deliveries this period.');
  });
});

describe('renderBillBodyHtml', () => {
  it('renders the same content as renderBillHtml but without a surrounding <html> document', () => {
    const body = renderBillBodyHtml(BASE);
    expect(body).not.toContain('<html>');
    expect(body).not.toContain('<head>');
    expect(body).toContain('SDM-000042');
    expect(body).toContain('Asha Patel');
  });
});

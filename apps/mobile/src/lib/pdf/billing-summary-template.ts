import { formatPaiseAsRupees } from '@/lib/money';

export type BillingSummaryPdfData = {
  business: {
    businessName: string;
    contactPhone: string | null;
    contactEmail: string | null;
    address: string | null;
  };
  monthLabel: string;
  rows: {
    customerName: string;
    billNumber: string;
    billedPaise: number;
    paidPaise: number;
    outstandingPaise: number;
  }[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Pure HTML builder for the billing-summary report PDF — no device APIs,
 * unit-testable on its own. Rendered by src/lib/pdf/generate.ts via
 * expo-print, same mechanism as bill-template.ts. Report generation is PDF
 * everywhere in this app — no CSV/other export formats (see docs/reports.md).
 */
export function renderBillingSummaryHtml(data: BillingSummaryPdfData): string {
  const { business, monthLabel, rows } = data;

  const totals = rows.reduce(
    (acc, r) => ({
      billed: acc.billed + r.billedPaise,
      paid: acc.paid + r.paidPaise,
      outstanding: acc.outstanding + r.outstandingPaise,
    }),
    { billed: 0, paid: 0, outstanding: 0 },
  );

  const rowsHtml = rows
    .map(
      (r) => `
        <tr>
          <td>${escapeHtml(r.customerName)}</td>
          <td>${escapeHtml(r.billNumber)}</td>
          <td class="num">${formatPaiseAsRupees(r.billedPaise)}</td>
          <td class="num">${formatPaiseAsRupees(r.paidPaise)}</td>
          <td class="num">${formatPaiseAsRupees(r.outstandingPaise)}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 0; }
    .muted { color: #666; font-size: 12px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { border-bottom: 1px solid #e0e0e0; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; }
    .num { text-align: right; }
    .totals { margin-top: 16px; width: 100%; max-width: 320px; margin-left: auto; font-size: 13px; }
    .totals td { border-bottom: none; padding: 3px 8px; }
    .totals .label { color: #555; }
    .totals .grand { font-weight: bold; font-size: 15px; border-top: 2px solid #1a1a1a; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(business.businessName)}</h1>
      <div class="muted">
        ${business.address ? escapeHtml(business.address) + '<br/>' : ''}
        ${business.contactPhone ? escapeHtml(business.contactPhone) + ' · ' : ''}${business.contactEmail ? escapeHtml(business.contactEmail) : ''}
      </div>
    </div>
    <div>
      <div><strong>Billing Summary</strong></div>
      <div class="muted">${escapeHtml(monthLabel)}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>Customer</th><th>Bill</th><th class="num">Billed</th><th class="num">Paid</th><th class="num">Outstanding</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="5">No bills for this month yet.</td></tr>'}</tbody>
  </table>

  <table class="totals">
    <tr><td class="label">Billed</td><td class="num">${formatPaiseAsRupees(totals.billed)}</td></tr>
    <tr><td class="label">Paid</td><td class="num">${formatPaiseAsRupees(totals.paid)}</td></tr>
    <tr class="grand"><td>Outstanding</td><td class="num">${formatPaiseAsRupees(totals.outstanding)}</td></tr>
  </table>
</body>
</html>`;
}

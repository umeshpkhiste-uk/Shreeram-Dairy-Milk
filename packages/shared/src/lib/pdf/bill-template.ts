import { formatPaiseAsRupees } from '../money';
import { BILL_STATUS_LABEL } from '../billing/status';
import type { BillStatus } from '../../types/database';

/**
 * Used by the website's print-to-PDF page (app/(admin)/billing/[id]/print).
 * Modeled directly on apps/mobile/src/lib/pdf/bill-template.ts (Stage 5) so
 * both apps render the same bill layout — kept as a deliberate duplicate
 * rather than a shared import from the mobile app's side: repointing
 * apps/mobile at this package would need Metro monorepo configuration
 * changes (watchFolders / resolver changes) in an already-shipped, fully
 * tested app, for a cosmetic-only win. See docs/web-admin.md. If either
 * copy's layout changes, update both.
 */
export type BillPdfData = {
  business: {
    businessName: string;
    contactPhone: string | null;
    contactEmail: string | null;
    address: string | null;
  };
  customer: {
    fullName: string;
    address: string;
    mobileNumber: string;
    accountReference: string | null;
  };
  bill: {
    billNumber: string;
    billingMonth: string; // YYYY-MM-01
    status: BillStatus;
    previousOutstandingBalancePaise: number;
    subtotalPaise: number;
    adjustmentsTotalPaise: number;
    totalPayablePaise: number;
  };
  items: {
    deliveryDate: string;
    milkTypeName: string;
    quantityMl: number;
    pricePaise: number;
    amountPaise: number;
  }[];
  adjustments: { reason: string; amountPaise: number }[];
  payments: {
    paymentDate: string;
    amountPaise: number;
    method: string;
    transactionReference: string | null;
  }[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function billingMonthLabel(billingMonth: string): string {
  const [year, month] = billingMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

/** The shared inline style block both renderers use (for the full document and the embedded-body page). */
export const BILL_STYLE = `
    .bill-doc { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; }
    .bill-doc h1 { font-size: 20px; margin-bottom: 0; }
    .bill-doc .muted { color: #666; font-size: 12px; }
    .bill-doc .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
    .bill-doc table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    .bill-doc th, .bill-doc td { border-bottom: 1px solid #e0e0e0; padding: 6px 8px; text-align: left; }
    .bill-doc th { background: #f5f5f5; }
    .bill-doc .num { text-align: right; }
    .bill-doc .totals { margin-top: 16px; width: 100%; max-width: 320px; margin-left: auto; font-size: 13px; }
    .bill-doc .totals td { border-bottom: none; padding: 3px 8px; }
    .bill-doc .totals .label { color: #555; }
    .bill-doc .totals .grand { font-weight: bold; font-size: 15px; border-top: 2px solid #1a1a1a; }
    .bill-doc .status { display: inline-block; padding: 2px 10px; border-radius: 10px; background: #eee; font-size: 12px; }
`;

/**
 * Just the bill's own markup (a `.bill-doc` wrapper div, no `<html>`/`<head>`)
 * — safe to embed inside an existing page via `dangerouslySetInnerHTML`
 * (the website's print page supplies `BILL_STYLE` itself, once, in its own
 * `<style>` tag).
 */
export function renderBillBodyHtml(data: BillPdfData): string {
  const { business, customer, bill, items, adjustments, payments } = data;

  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.deliveryDate)}</td>
          <td>${escapeHtml(item.milkTypeName)}</td>
          <td class="num">${item.quantityMl} ml</td>
          <td class="num">${formatPaiseAsRupees(item.pricePaise)}/L</td>
          <td class="num">${formatPaiseAsRupees(item.amountPaise)}</td>
        </tr>`,
    )
    .join('');

  const adjustmentRows = adjustments
    .map(
      (adj) => `
        <tr>
          <td colspan="4">${escapeHtml(adj.reason)}</td>
          <td class="num">${formatPaiseAsRupees(adj.amountPaise)}</td>
        </tr>`,
    )
    .join('');

  const paymentRows = payments
    .map(
      (p) => `
        <tr>
          <td>${escapeHtml(p.paymentDate)}</td>
          <td>${escapeHtml(p.method)}</td>
          <td>${p.transactionReference ? escapeHtml(p.transactionReference) : '—'}</td>
          <td class="num">${formatPaiseAsRupees(p.amountPaise)}</td>
        </tr>`,
    )
    .join('');

  const paymentsTotal = payments.reduce((sum, p) => sum + p.amountPaise, 0);

  return `<div class="bill-doc">
  <div class="header">
    <div>
      <h1>${escapeHtml(business.businessName)}</h1>
      <div class="muted">
        ${business.address ? escapeHtml(business.address) + '<br/>' : ''}
        ${business.contactPhone ? escapeHtml(business.contactPhone) + ' · ' : ''}${business.contactEmail ? escapeHtml(business.contactEmail) : ''}
      </div>
    </div>
    <div>
      <div><strong>Bill ${escapeHtml(bill.billNumber)}</strong></div>
      <div class="muted">${billingMonthLabel(bill.billingMonth)}</div>
      <div class="status">${BILL_STATUS_LABEL[bill.status]}</div>
    </div>
  </div>

  <div>
    <strong>${escapeHtml(customer.fullName)}</strong><br/>
    <span class="muted">${escapeHtml(customer.address)}<br/>${escapeHtml(customer.mobileNumber)}${customer.accountReference ? ' · Ref: ' + escapeHtml(customer.accountReference) : ''}</span>
  </div>

  <h3>Delivery breakdown</h3>
  <table>
    <thead><tr><th>Date</th><th>Milk type</th><th class="num">Quantity</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="5">No billable deliveries this period.</td></tr>'}</tbody>
  </table>

  ${
    adjustments.length > 0
      ? `<h3>Adjustments</h3><table><tbody>${adjustmentRows}</tbody></table>`
      : ''
  }

  ${
    payments.length > 0
      ? `<h3>Payments received</h3>
         <table>
           <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="num">Amount</th></tr></thead>
           <tbody>${paymentRows}</tbody>
         </table>`
      : ''
  }

  <table class="totals">
    <tr><td class="label">Previous outstanding balance</td><td class="num">${formatPaiseAsRupees(bill.previousOutstandingBalancePaise)}</td></tr>
    <tr><td class="label">Delivery charges</td><td class="num">${formatPaiseAsRupees(bill.subtotalPaise)}</td></tr>
    <tr><td class="label">Adjustments</td><td class="num">${formatPaiseAsRupees(bill.adjustmentsTotalPaise)}</td></tr>
    <tr><td class="label">Payments received</td><td class="num">-${formatPaiseAsRupees(paymentsTotal)}</td></tr>
    <tr class="grand"><td>Amount due</td><td class="num">${formatPaiseAsRupees(
      bill.totalPayablePaise - paymentsTotal,
    )}</td></tr>
  </table>
</div>`;
}

/** Pure HTML builder for a full standalone document — used by expo-print on mobile. */
export function renderBillHtml(data: BillPdfData): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>body { margin: 0; padding: 24px; }${BILL_STYLE}</style>
</head>
<body>
  ${renderBillBodyHtml(data)}
</body>
</html>`;
}

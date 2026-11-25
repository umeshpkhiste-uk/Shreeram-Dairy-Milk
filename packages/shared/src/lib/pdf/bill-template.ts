import { formatPaiseAsRupees } from '../money';
import { formatBillPeriod } from '../date';
import { formatQuantityTotal, unitLabel } from '../quantity';
import { BILL_STATUS_LABEL, billAmountDue } from '../billing/status';
import type { BillStatus, ProductUnit } from '../../types/database';

/** What the `get_bill_document` RPC returns: the admin's bill page, the customer's link (app/bill/[id]) and the WhatsApp message. */
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
    billedThrough: string; // YYYY-MM-DD
    status: BillStatus;
    previousOutstandingBalancePaise: number;
    subtotalPaise: number;
    adjustmentsTotalPaise: number;
    totalPayablePaise: number;
  };
  /** Days the customer informed, so nothing was delivered. */
  noDeliveryDays: number;
  items: {
    deliveryDate: string;
    milkTypeName: string;
    quantityMl: number;
    unit: ProductUnit | undefined;
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

export type BillLine = {
  milkTypeName: string;
  unit: ProductUnit | undefined;
  pricePaise: number;
  days: number;
  quantityMl: number;
  amountPaise: number;
};

/** One line per product and rate. */
export function groupBillItems(items: BillPdfData['items']): BillLine[] {
  const lines = new Map<string, BillLine & { dates: Set<string> }>();
  for (const item of items) {
    const key = `${item.milkTypeName}|${item.pricePaise}`;
    const line = lines.get(key) ?? { ...item, days: 0, quantityMl: 0, amountPaise: 0, dates: new Set() };
    line.dates.add(item.deliveryDate);
    line.days = line.dates.size;
    line.quantityMl += item.quantityMl;
    line.amountPaise += item.amountPaise;
    lines.set(key, line);
  }
  return [...lines.values()];
}

export function daysDelivered(items: BillPdfData['items']): number {
  return new Set(items.map((item) => item.deliveryDate)).size;
}

/** The inline styles for `renderBillBodyHtml` and the order receipt. */
export const BILL_STYLE = `
    .bill-doc { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; }
    .bill-doc h1 { font-size: 20px; margin-bottom: 0; }
    .bill-doc .muted { color: #666; font-size: 12px; }
    .bill-doc .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
    .bill-doc .header .business { display: flex; gap: 10px; align-items: flex-start; }
    .bill-doc .logo { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; }
    .bill-doc table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    .bill-doc th, .bill-doc td { border-bottom: 1px solid #e0e0e0; padding: 6px 8px; text-align: left; }
    .bill-doc th { background: #f5f5f5; }
    .bill-doc .num { text-align: right; }
    .bill-doc .totals { margin-top: 16px; width: 100%; max-width: 320px; margin-left: auto; font-size: 13px; }
    .bill-doc .totals td { border-bottom: none; padding: 3px 8px; }
    .bill-doc .totals .label { color: #555; }
    .bill-doc .totals .grand { font-weight: bold; font-size: 15px; border-top: 2px solid #1a1a1a; }
    .bill-doc .doc-info { text-align: right; padding-right: 8px; white-space: nowrap; }
    .bill-doc .status { font-size: 12px; font-weight: bold; }
    @media (max-width: 480px) {
      .bill-doc .header { flex-direction: column; gap: 12px; }
      .bill-doc .doc-info { text-align: left; }
      .bill-doc th, .bill-doc td { padding: 6px 4px; font-size: 12px; }
    }
`;

/**
 * Just the bill's own markup (a `.bill-doc` wrapper div, no `<html>`/`<head>`)
 * — safe to embed inside an existing page via `dangerouslySetInnerHTML`
 * (the website's print page supplies `BILL_STYLE` itself, once, in its own
 * `<style>` tag).
 */
export function renderBillBodyHtml(data: BillPdfData): string {
  const { business, customer, bill, items, adjustments, payments } = data;

  const itemRows = groupBillItems(items)
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.milkTypeName)}</td>
          <td class="num">${line.days}</td>
          <td class="num">${formatQuantityTotal([{ quantity: line.quantityMl, unit: line.unit }])}</td>
          <td class="num">${formatPaiseAsRupees(line.pricePaise)}/${unitLabel(line.unit)}</td>
          <td class="num">${formatPaiseAsRupees(line.amountPaise)}</td>
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
  const { duePaise, settledElsewherePaise } = billAmountDue(
    bill.status,
    bill.totalPayablePaise,
    paymentsTotal,
  );

  return `<div class="bill-doc">
  <div class="header">
    <div class="business">
      <img class="logo" src="/logo.png" alt="" />
      <div>
        <h1>${escapeHtml(business.businessName)}</h1>
        <div class="muted">
          ${business.address ? escapeHtml(business.address) + '<br/>' : ''}
          ${business.contactPhone ? escapeHtml(business.contactPhone) + ' · ' : ''}${business.contactEmail ? escapeHtml(business.contactEmail) : ''}
        </div>
      </div>
    </div>
    <div class="doc-info">
      <div><strong>Bill ${escapeHtml(bill.billNumber)}</strong></div>
      <div class="muted">${formatBillPeriod(bill.billingMonth, bill.billedThrough)}</div>
      <div class="status">${BILL_STATUS_LABEL[bill.status]}</div>
    </div>
  </div>

  <div>
    <strong>${escapeHtml(customer.fullName)}</strong><br/>
    <span class="muted">${escapeHtml(customer.address)}<br/>${escapeHtml(customer.mobileNumber)}${customer.accountReference ? ' · Ref: ' + escapeHtml(customer.accountReference) : ''}</span>
  </div>

  <h3>Delivery breakdown</h3>
  <div class="muted">Days delivered: ${daysDelivered(items)} · Days customer informed, no delivery: ${data.noDeliveryDays}</div>
  <table>
    <thead><tr><th>Product type</th><th class="num">Total days delivery</th><th class="num">Quantity</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
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
    <tr><td class="label">Payments received</td><td class="num">-${formatPaiseAsRupees(paymentsTotal)}</td></tr>${
      settledElsewherePaise > 0
        ? `
    <tr><td class="label">Settled on another bill</td><td class="num">-${formatPaiseAsRupees(settledElsewherePaise)}</td></tr>`
        : ''
    }
    <tr class="grand"><td>Amount due</td><td class="num">${formatPaiseAsRupees(duePaise)}</td></tr>
  </table>
</div>`;
}

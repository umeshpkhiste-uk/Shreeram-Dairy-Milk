import { formatPaiseAsRupees } from '../money';
import { upiPayUrl } from '../upi';
import { formatBillPeriod, formatBillingMonth } from '../date';
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
    upiId: string | null;
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
  /** The newest generated bill that already carries this one's balance, if it is not paid. */
  includedIn: string | null;
  /** Payment details the customer sent that no admin has checked yet. */
  pendingClaims: { amountPaise: number; transactionReference: string }[];
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
  /** "1–14 Nov · 1.00 L a day", only when the product's rate or quantity changed in the month. */
  detail: string | null;
};

function dayRange([from, to]: [string, string]): string {
  const month = formatBillingMonth(to).slice(0, 3);
  const day = (date: string) => Number(date.slice(8));
  return from === to ? `${day(to)} ${month}` : `${day(from)}–${day(to)} ${month}`;
}

/** One line per product, rate and daily quantity. A product's changes follow each other. */
export function groupBillItems(items: BillPdfData['items']): BillLine[] {
  type Group = BillLine & { dailyQuantity: number; runs: [string, string][] };
  const products = new Map<string, { groups: Map<string, Group>; last?: Group }>();

  for (const item of [...items].sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))) {
    const product = products.get(item.milkTypeName) ?? { groups: new Map<string, Group>() };
    products.set(item.milkTypeName, product);
    const key = `${item.pricePaise}|${item.quantityMl}`;
    const group: Group = product.groups.get(key) ?? {
      milkTypeName: item.milkTypeName,
      unit: item.unit,
      pricePaise: item.pricePaise,
      days: 0,
      quantityMl: 0,
      amountPaise: 0,
      detail: null,
      dailyQuantity: item.quantityMl,
      runs: [],
    };
    product.groups.set(key, group);
    group.days += 1; // one item per product and day
    group.quantityMl += item.quantityMl;
    group.amountPaise += item.amountPaise;
    const run = group.runs.at(-1);
    if (run && product.last === group) run[1] = item.deliveryDate;
    else group.runs.push([item.deliveryDate, item.deliveryDate]);
    product.last = group;
  }

  return [...products.values()].flatMap(({ groups }) =>
    [...groups.values()].map(({ dailyQuantity, runs, ...line }) => ({
      ...line,
      detail:
        groups.size === 1
          ? null
          : `${runs.map(dayRange).join(', ')} · ` +
            `${formatQuantityTotal([{ quantity: dailyQuantity, unit: line.unit }])} a day`,
    })),
  );
}

/** What the customer still has to send: the amount due less the payments they told us about. */
export function amountToPay(data: BillPdfData): number {
  const { duePaise } = billAmountDue(
    data.bill.status,
    data.bill.totalPayablePaise,
    data.payments.reduce((sum, p) => sum + p.amountPaise, 0),
  );
  return Math.max(0, duePaise - data.pendingClaims.reduce((sum, c) => sum + c.amountPaise, 0));
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
    .bill-doc .party { display: flex; justify-content: space-between; gap: 24px; line-height: 1.6; }
    .bill-doc .party .muted { line-height: 1.6; }
    .bill-doc .party .pay { text-align: right; padding-right: 8px; white-space: nowrap; }
    .bill-doc .party .pay a { color: #1d5fa8; text-decoration: underline; }
    .bill-doc .section { margin-top: 24px; }
    .bill-doc .note { margin-top: 16px; padding: 8px; border: 1px solid #b45309; font-size: 13px; }
    .bill-doc .bill-totals { max-width: none; }
    .bill-doc .bill-totals .label { width: 200px; }
    .bill-doc .bill-totals .num { width: 120px; }
    .bill-doc .bill-totals .heading { font-size: 16px; font-weight: bold; }
    .bill-doc .bill-totals .adjustments td { border-top: 1px solid #e0e0e0; }
    .bill-doc .bill-totals .grand { border-top: none; }
    .bill-doc .bill-totals .grand td + td { border-top: 2px solid #1a1a1a; white-space: nowrap; }
    .bill-doc .status { font-size: 12px; font-weight: bold; }
    @media (max-width: 480px) {
      .bill-doc .header { flex-direction: column; gap: 12px; }
      .bill-doc .doc-info, .bill-doc .party .pay { text-align: left; }
      .bill-doc .party { flex-direction: column; gap: 12px; }
      .bill-doc th, .bill-doc td { padding: 6px 4px; font-size: 12px; }
      .bill-doc .bill-totals .label { width: auto; }
      .bill-doc .bill-totals td { padding: 3px 4px; }
      .bill-doc .bill-totals .heading { font-size: 14px; }
      .bill-doc .bill-totals .grand { font-size: 14px; }
      .bill-doc .bill-totals .grand td + td { white-space: normal; }
      .bill-doc .bill-totals .grand td.num, .bill-doc .bill-totals .num { width: 1%; white-space: nowrap; }
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
          <td>${escapeHtml(line.milkTypeName)}${line.detail ? `<div class="muted">${escapeHtml(line.detail)}</div>` : ''}</td>
          <td class="num">${line.days}</td>
          <td class="num">${formatQuantityTotal([{ quantity: line.quantityMl, unit: line.unit }])}</td>
          <td class="num">${formatPaiseAsRupees(line.pricePaise)}/${unitLabel(line.unit)}</td>
          <td class="num">${formatPaiseAsRupees(line.amountPaise)}</td>
        </tr>`,
    )
    .join('');

  const adjustmentRows = adjustments
    .map(
      (adj, index) => `
    <tr${index === 0 ? ' class="adjustments"' : ''}>
          <td class="heading">${index === 0 ? 'Adjustments' : ''}</td>
          <td class="label">${escapeHtml(adj.reason)}</td>
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

  // A mobile number alone can't be a UPI link, so both open the UPI ID.
  const upiLink = (text: string) =>
    business.upiId && !data.includedIn
      ? `<a href="${escapeHtml(
          upiPayUrl({
            upiId: business.upiId,
            name: business.businessName,
            amountPaise: amountToPay(data),
            note: `Bill ${bill.billNumber}`,
          }),
        )}">${escapeHtml(text)}</a>`
      : escapeHtml(text);

  return `<div class="bill-doc">
  <div class="header">
    <div class="business">
      <img class="logo" src="/logo.png" alt="" />
      <div>
        <h1>${escapeHtml(business.businessName)}</h1>
        <div class="muted">
          ${business.address ? escapeHtml(business.address) + '<br/>' : ''}
          ${[business.contactPhone, business.contactEmail].filter((v) => v !== null).map(escapeHtml).join(' · ')}
        </div>
      </div>
    </div>
    <div class="doc-info">
      <div><strong>Bill ${escapeHtml(bill.billNumber)}</strong></div>
      <div class="muted">${formatBillPeriod(bill.billingMonth, bill.billedThrough)}</div>
      ${bill.status !== 'finalized' ? `<div class="status">${BILL_STATUS_LABEL[bill.status]}</div>` : ''}
    </div>
  </div>

  <div class="party">
    <div>
      <strong>Bill For: ${escapeHtml(customer.fullName)}</strong>
      <div class="muted">Address: ${escapeHtml(customer.address)}</div>
      <div class="muted">Contact: ${escapeHtml(customer.mobileNumber)}</div>
    </div>
    ${
      business.contactPhone || business.upiId
        ? `<div class="pay">
      <strong>Payment method:</strong>
      ${business.contactPhone ? `<div class="muted">Pay to: ${upiLink(business.contactPhone)}</div>` : ''}
      ${business.upiId ? `<div class="muted">UPI ID: ${upiLink(business.upiId)}</div>` : ''}
    </div>`
        : ''
    }
  </div>

  ${
    data.includedIn
      ? `<div class="note">This amount is already included in bill ${escapeHtml(data.includedIn)}. Please pay that bill.</div>`
      : ''
  }

  <h3 class="section">Delivery breakdown</h3>
  <div class="muted">Days delivered: ${daysDelivered(items)} · Days customer informed, no delivery: ${data.noDeliveryDays}</div>
  <table>
    <thead><tr><th>Product type</th><th class="num">Total days delivery</th><th class="num">Quantity</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="5">No billable deliveries this period.</td></tr>'}</tbody>
  </table>

  ${
    payments.length > 0
      ? `<h3 class="section">Payments received</h3>
         <table>
           <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="num">Amount</th></tr></thead>
           <tbody>${paymentRows}</tbody>
         </table>`
      : ''
  }

  <table class="totals bill-totals">
    <tr><td></td><td class="label">Previous outstanding balance</td><td class="num">${formatPaiseAsRupees(bill.previousOutstandingBalancePaise)}</td></tr>
    <tr><td></td><td class="label">Current Month Charges</td><td class="num">${formatPaiseAsRupees(bill.subtotalPaise)}</td></tr>
    <tr><td></td><td class="label">Payments received</td><td class="num">-${formatPaiseAsRupees(paymentsTotal)}</td></tr>${adjustmentRows}${
      settledElsewherePaise > 0
        ? `
    <tr><td></td><td class="label">Settled on another bill</td><td class="num">-${formatPaiseAsRupees(settledElsewherePaise)}</td></tr>`
        : ''
    }
    <tr class="grand"><td></td><td>Total Amount to be Paid</td><td class="num">${formatPaiseAsRupees(duePaise)}</td></tr>
  </table>
</div>`;
}

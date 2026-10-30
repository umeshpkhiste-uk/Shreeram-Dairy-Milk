import { formatPaiseAsRupees } from '../money';
import { BILL_STYLE } from './bill-template';
import type { OrderPaymentStatus, PaymentMethod, ProductUnit } from '../../types/database';

/**
 * A receipt for a one-time product order (Stage 8) — separate from the
 * monthly milk bill (bill-template.ts), reusing its BILL_STYLE for a
 * consistent look. See docs/web-admin.md "One-time product orders".
 */
export type OrderReceiptPdfData = {
  business: {
    businessName: string;
    contactPhone: string | null;
    contactEmail: string | null;
    address: string | null;
  };
  customerName: string;
  orderDate: string;
  notes: string | null;
  paymentStatus: OrderPaymentStatus;
  paymentMethod: PaymentMethod | null;
  items: { productName: string; unit: ProductUnit; quantity: number; pricePaise: number; amountPaise: number }[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

export function renderOrderReceiptBodyHtml(data: OrderReceiptPdfData): string {
  const { business, customerName, orderDate, notes, paymentStatus, paymentMethod, items } = data;

  const itemRows = items
    .map((item) => {
      const qtyLabel = `${(item.quantity / 1000).toFixed(2)} ${item.unit === 'litre' ? 'L' : 'Kg'}`;
      return `
        <tr>
          <td>${escapeHtml(item.productName)}</td>
          <td class="num">${qtyLabel}</td>
          <td class="num">${formatPaiseAsRupees(item.pricePaise)}/${item.unit === 'litre' ? 'L' : 'Kg'}</td>
          <td class="num">${formatPaiseAsRupees(item.amountPaise)}</td>
        </tr>`;
    })
    .join('');

  const total = items.reduce((sum, i) => sum + i.amountPaise, 0);

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
    <div>
      <div><strong>Order Receipt</strong></div>
      <div class="muted">${escapeHtml(orderDate)}</div>
      <div class="status">${paymentStatus === 'paid' ? 'Paid' + (paymentMethod ? ' · ' + PAYMENT_METHOD_LABEL[paymentMethod] : '') : 'Unpaid'}</div>
    </div>
  </div>

  <div>
    <strong>${escapeHtml(customerName)}</strong>
  </div>

  <h3>Items</h3>
  <table>
    <thead><tr><th>Item</th><th class="num">Quantity</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="totals">
    <tr class="grand"><td>Total</td><td class="num">${formatPaiseAsRupees(total)}</td></tr>
  </table>

  ${notes ? `<p class="muted">Note: ${escapeHtml(notes)}</p>` : ''}
</div>`;
}

export { BILL_STYLE as ORDER_RECEIPT_STYLE };

import { formatBillPeriod } from '../date';
import { formatPaiseAsRupees } from '../money';
import { groupBillItems, type BillPdfData } from '../pdf/bill-template';
import { formatQuantityTotal, unitLabel } from '../quantity';
import { billAmountDue } from './status';

/** WhatsApp needs the country code and digits only; a bare 10-digit number is Indian. */
export function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

/** The bill as a WhatsApp text (*bold* is WhatsApp's own markup). */
export function billMessage(data: BillPdfData, link: string): string {
  const { business, customer, bill, items, payments, noDeliveryDays } = data;
  const paid = payments.reduce((sum, p) => sum + p.amountPaise, 0);
  const { duePaise, settledElsewherePaise } = billAmountDue(
    bill.status,
    bill.totalPayablePaise,
    paid,
  );
  const amount = (label: string, paise: number) =>
    paise === 0 ? [] : [`${label}: ${formatPaiseAsRupees(paise)}`];

  return [
    `*${business.businessName}*`,
    `Dear ${customer.fullName},`,
    `Bill ${bill.billNumber} for ${formatBillPeriod(bill.billingMonth, bill.billedThrough)}`,
    '',
    ...groupBillItems(items).map(
      (line) =>
        `${line.milkTypeName}: ${line.days} ${line.days === 1 ? 'day' : 'days'}, ` +
        `${formatQuantityTotal([{ quantity: line.quantityMl, unit: line.unit }])} x ` +
        `${formatPaiseAsRupees(line.pricePaise)}/${unitLabel(line.unit)} = ${formatPaiseAsRupees(line.amountPaise)}`,
    ),
    `No delivery (you informed us): ${noDeliveryDays} ${noDeliveryDays === 1 ? 'day' : 'days'}`,
    '',
    ...amount('Previous balance', bill.previousOutstandingBalancePaise),
    ...amount('Current Month Charges', bill.subtotalPaise),
    ...amount('Adjustments', bill.adjustmentsTotalPaise),
    ...amount('Payments received', -paid),
    ...amount('Settled on another bill', -settledElsewherePaise),
    `*Total Amount to be Paid: ${formatPaiseAsRupees(duePaise)}*`,
    '',
    `See or save your bill: ${link}`,
  ].join('\n');
}

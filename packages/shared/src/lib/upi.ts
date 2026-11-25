import { formatPaiseAsRupees } from './money';

/** A link that opens the phone's UPI app with the payment filled in; no amount when nothing is due. */
export function upiPayUrl(to: { upiId: string; name: string; amountPaise: number; note: string }): string {
  return (
    // Some UPI apps don't decode %40.
    `upi://pay?pa=${encodeURIComponent(to.upiId).replace('%40', '@')}` +
    `&pn=${encodeURIComponent(to.name)}` +
    (to.amountPaise > 0 ? `&am=${formatPaiseAsRupees(to.amountPaise).slice(1)}` : '') +
    `&cu=INR&tn=${encodeURIComponent(to.note)}`
  );
}

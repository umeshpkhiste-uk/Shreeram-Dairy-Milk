import type { BillStatus } from '../../types/database';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  draft: 'Draft',
  finalized: 'Finalized',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  voided: 'Voided',
};

export const BILL_STATUS_TONE: Record<BillStatus, StatusTone> = {
  draft: 'neutral',
  finalized: 'info',
  partially_paid: 'warning',
  paid: 'success',
  voided: 'danger',
};

/**
 * Mirrors the per-bill part of `public._recompute_customer_bill_statuses` (see
 * supabase/migrations/20261125130000_void_check_and_settled_bills.sql), which also marks a bill
 * paid once a later bill carrying its balance is settled — used for optimistic UI
 * right after a payment/adjustment RPC call returns, never as a substitute for the server's
 * own recomputation. `currentStatus` lets `draft`/`voided` pass through unchanged, since only
 * `finalize_bill`/`void_bill` ever set those.
 */
export function paymentOutcomeStatus(
  currentStatus: BillStatus,
  totalPayablePaise: number,
  totalPaidPaise: number,
): BillStatus {
  if (currentStatus === 'draft' || currentStatus === 'voided') {
    return currentStatus;
  }
  if (totalPaidPaise >= totalPayablePaise) {
    return 'paid';
  }
  if (totalPaidPaise > 0) {
    return 'partially_paid';
  }
  return 'finalized';
}

/**
 * What is still due on a bill. A `paid` bill has nothing due even when the money was recorded on
 * another bill that included its balance; that part is `settledElsewherePaise`.
 */
export function billAmountDue(
  status: BillStatus,
  totalPayablePaise: number,
  totalPaidPaise: number,
): { duePaise: number; settledElsewherePaise: number } {
  const unpaid = totalPayablePaise - totalPaidPaise;
  const duePaise = status === 'paid' ? Math.min(unpaid, 0) : unpaid;
  return { duePaise, settledElsewherePaise: unpaid - duePaise };
}

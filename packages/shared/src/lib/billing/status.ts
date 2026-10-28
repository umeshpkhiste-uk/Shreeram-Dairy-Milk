import type { BillStatus } from '../../types/database';

/** Mirrors the mobile app's `StatusTone` (apps/mobile/src/components/status-badge.tsx) without depending on its UI component. */
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
 * Mirrors `public._recompute_bill_status` exactly (see
 * supabase/migrations/20261028110005_stage5_status_case_fix.sql) — used for optimistic UI
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

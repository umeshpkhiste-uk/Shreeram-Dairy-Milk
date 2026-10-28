'use client';

import { useState, useTransition } from 'react';

type Props = {
  billId: string;
  paymentId: string;
  action: (billId: string, paymentId: string, reason: string) => Promise<void>;
};

/**
 * Voiding a real payment is a destructive financial action — it must never
 * happen from a single click with a hardcoded generic reason (that exact
 * mistake was caught and fixed in the mobile app's bill-detail screen, see
 * docs/billing.md). An explicit reason is required every time.
 */
export function VoidPaymentButton({ billId, paymentId, action }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-danger hover:underline"
      >
        Void
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for voiding"
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-primary"
      />
      <button
        type="button"
        disabled={pending || reason.trim().length === 0}
        onClick={() => startTransition(() => void action(billId, paymentId, reason.trim()))}
        className="text-sm font-medium text-danger hover:underline disabled:opacity-50"
      >
        {pending ? 'Voiding…' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm font-medium text-text-secondary hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}

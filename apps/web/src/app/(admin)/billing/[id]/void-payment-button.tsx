'use client';

import { useState, useTransition } from 'react';

import { DangerButton, ErrorText, SecondaryButton } from '@/components/ui';

import type { ActionState } from '../actions';

type Props = {
  billId: string;
  paymentId: string;
  action: (billId: string, paymentId: string, reason: string) => Promise<ActionState>;
};

/**
 * Voiding a real payment is a destructive financial action — it must never
 * happen from a single click with a hardcoded generic reason. An explicit reason is required every time.
 */
export function VoidPaymentButton({ billId, paymentId, action }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // DangerButton already ignores repeat clicks.
  const confirm = () =>
    startTransition(async () => {
      setError((await action(billId, paymentId, reason.trim())).error);
    });

  if (!open) {
    return (
      <DangerButton type="button" onClick={() => setOpen(true)}>
        Undo payment
      </DangerButton>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why was this payment wrong?"
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
      />
      <DangerButton
        type="button"
        disabled={pending || reason.trim().length === 0}
        onClick={confirm}
      >
        {pending ? 'Undoing…' : 'Confirm'}
      </DangerButton>
      <SecondaryButton type="button" onClick={() => setOpen(false)}>
        Cancel
      </SecondaryButton>
      {error ? <ErrorText message={error} /> : null}
    </div>
  );
}

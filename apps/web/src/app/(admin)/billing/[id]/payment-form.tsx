'use client';

import { useActionState, useState } from 'react';

import { PAYMENT_METHOD_OPTIONS } from '@shreeram/shared';

import { ErrorText, PrimaryButton } from '@/components/ui';

import type { ActionState } from '../actions';

const inputClass =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary';
const labelClass = 'flex flex-col gap-1 text-sm font-medium text-text';

export function PaymentForm({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  // Generated once, when this form mounts, and reused across every submit
  // attempt (including a retry after this action's own error return) — see
  // the comment on recordPaymentAction in ../actions.ts for why.
  const [paymentId] = useState(() => crypto.randomUUID());

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="paymentId" value={paymentId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Amount (₹)
          <input name="amountRupees" required placeholder="500.00" className={inputClass} />
        </label>
        <label className={labelClass}>
          Method
          <select name="method" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select a method
            </option>
            {PAYMENT_METHOD_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Payment date
          <input
            name="paymentDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Transaction reference (optional)
          <input name="transactionReference" className={inputClass} />
        </label>
        <label className={labelClass}>
          Method detail (optional)
          <input name="methodDetail" className={inputClass} />
        </label>
        <label className={labelClass}>
          Notes (optional)
          <input name="notes" className={inputClass} />
        </label>
      </div>
      {state.error ? <ErrorText message={state.error} /> : null}
      <PrimaryButton type="submit" disabled={pending} className="self-start">
        {pending ? 'Recording…' : 'Record payment'}
      </PrimaryButton>
    </form>
  );
}

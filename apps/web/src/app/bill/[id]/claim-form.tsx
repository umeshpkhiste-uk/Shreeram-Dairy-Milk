'use client';

import { startTransition, useActionState, useState } from 'react';

import { ErrorText, PrimaryButton } from '@/components/ui';

type ActionState = { error: string | null };

const labelClass = 'flex flex-col gap-1 text-sm font-medium text-text';
const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary';

export function ClaimForm({
  action,
  duePaise,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  duePaise: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, { error: null });

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text">Already paid by UPI? Send us the transaction number.</p>
        <PrimaryButton type="button" onClick={() => setOpen(true)}>
          I have paid
        </PrimaryButton>
      </div>
    );
  }

  return (
    <form
      // Not `action`: React would clear everything typed when it is refused.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Amount paid (₹)
          <input
            name="amountRupees"
            required
            inputMode="decimal"
            defaultValue={(duePaise / 100).toFixed(2)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          UPI transaction number (12 digits)
          <input
            name="reference"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="UTR or UPI transaction ID"
            className={inputClass}
          />
        </label>
      </div>
      <p className="text-sm text-text-secondary">
        You can find it in your UPI app, in the details of this payment. Your bill is marked paid
        after we check it.
      </p>
      {state.error ? <ErrorText message={state.error} /> : null}
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send'}
      </PrimaryButton>
    </form>
  );
}

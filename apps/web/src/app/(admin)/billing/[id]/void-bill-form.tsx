'use client';

import { useActionState, useState } from 'react';

import { DangerButton, ErrorText, SecondaryButton } from '@/components/ui';

import type { ActionState } from '../actions';

export function VoidBillForm({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, { error: null });

  if (!open) {
    return (
      <SecondaryButton type="button" onClick={() => setOpen(true)}>
        Void bill
      </SecondaryButton>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Reason for voiding
        <input
          name="reason"
          required
          className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>
      <DangerButton type="submit" disabled={pending}>
        {pending ? 'Voiding…' : 'Confirm void'}
      </DangerButton>
      <SecondaryButton type="button" onClick={() => setOpen(false)}>
        Cancel
      </SecondaryButton>
      {state.error ? <ErrorText message={state.error} /> : null}
    </form>
  );
}

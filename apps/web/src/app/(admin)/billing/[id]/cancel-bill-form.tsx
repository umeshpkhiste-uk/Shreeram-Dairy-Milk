'use client';

import { useActionState, useState } from 'react';

import { DangerButton, ErrorText, SecondaryButton } from '@/components/ui';

import type { ActionState } from '../actions';

export function CancelBillForm({
  action,
}: {
  action: () => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState>(action, { error: null });

  if (!open) {
    return (
      <DangerButton type="button" onClick={() => setOpen(true)}>
        Cancel bill
      </DangerButton>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-danger">
        Delete this draft bill completely? This can&rsquo;t be undone.
      </p>
      <DangerButton type="submit" disabled={pending}>
        {pending ? 'Cancelling…' : 'Yes, cancel bill'}
      </DangerButton>
      <SecondaryButton type="button" disabled={pending} onClick={() => setOpen(false)}>
        Keep bill
      </SecondaryButton>
      {state.error ? <ErrorText message={state.error} /> : null}
    </form>
  );
}

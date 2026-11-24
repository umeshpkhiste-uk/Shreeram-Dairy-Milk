'use client';

import { useActionState, useRef } from 'react';

import { DangerButton, ErrorText, SecondaryButton } from '@/components/ui';

import type { ActionState } from '../actions';

export function CancelBillForm({
  action,
}: {
  action: () => Promise<ActionState>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState<ActionState>(action, { error: null });

  return (
    <>
      <DangerButton type="button" onClick={() => dialogRef.current?.showModal()}>
        Cancel bill
      </DangerButton>
      <dialog
        ref={dialogRef}
        aria-labelledby="cancel-bill-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-surface p-6 text-text shadow-lg backdrop:bg-black/50"
      >
        <form action={formAction} className="flex flex-col gap-4">
          <h2 id="cancel-bill-title" className="text-lg font-semibold">
            Cancel this bill?
          </h2>
          <p className="text-sm text-danger">
            Delete this draft bill completely? This can&rsquo;t be undone.
          </p>
          {state.error ? <ErrorText message={state.error} /> : null}
          {/* Keep bill first: the dialog focuses it, so Enter is the safe choice. */}
          <div className="flex flex-wrap justify-end gap-3">
            <SecondaryButton
              type="button"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
            >
              Keep bill
            </SecondaryButton>
            <DangerButton type="submit" disabled={pending}>
              {pending ? 'Cancelling…' : 'Yes, cancel bill'}
            </DangerButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

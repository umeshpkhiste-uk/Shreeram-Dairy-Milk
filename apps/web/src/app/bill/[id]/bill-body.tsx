'use client';

import { useRef } from 'react';

import { PrimaryButton } from '@/components/ui';

/** The bill; once the payment link has expired, its UPI links show a pop-up instead of opening the UPI app. */
export function BillBody({ html, expiresAt }: { html: string; expiresAt: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <div
        className="overflow-x-auto rounded-lg border border-border bg-white p-4 sm:p-8"
        onClickCapture={(e) => {
          const upi = (e.target as Element).closest('a[href^="upi:"]');
          if (upi && expiresAt && Date.now() >= new Date(expiresAt).getTime()) {
            e.preventDefault();
            dialog.current?.showModal();
          }
        }}
        // Content is built entirely from this app's own escaping renderer
        // (packages/shared/src/lib/pdf/bill-template.ts).
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <dialog
        ref={dialog}
        className="m-auto w-[min(24rem,90vw)] rounded-lg border border-border bg-surface p-5 text-text shadow-lg backdrop:bg-black/40"
      >
        <h2 className="text-lg font-semibold">Payment link expired</h2>
        <p className="mt-2 text-sm text-text-secondary">
          This payment link was valid for 1 day. Please ask us to send you a new payment link.
        </p>
        <form method="dialog" className="mt-4 flex justify-end">
          <PrimaryButton type="submit">OK</PrimaryButton>
        </form>
      </dialog>
    </>
  );
}

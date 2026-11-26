'use client';

import { useState, useTransition } from 'react';

import { ErrorText, InfoButton } from '@/components/ui';

import { renewPaymentLinkAction } from '../actions';
import { whatsappUrl } from './generate-bill-button';

/** Usable only once the customer's UPI pay link has expired; renews it and sends the bill again. */
export function NewPaymentLinkButton({ billId, expired }: { billId: string; expired: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function renew() {
    // Opened during the click, or the browser blocks it as a pop-up.
    const chat = window.open('', '_blank');
    if (chat) chat.opener = null;
    setError(null);
    startTransition(async () => {
      const result = await renewPaymentLinkAction(billId, `${window.location.origin}/bill/${billId}`);
      if (result.error) {
        chat?.close();
        setError(result.error);
        return;
      }
      const url = whatsappUrl(result.phone, result.message);
      if (chat) chat.location.href = url;
      else window.location.href = url;
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <InfoButton
        type="button"
        disabled={!expired || pending}
        title={expired ? undefined : 'Available once the current payment link expires (1 day after sending)'}
        onClick={renew}
      >
        {pending ? 'Sending…' : 'New Payment Link'}
      </InfoButton>
      {error ? <ErrorText message={error} /> : null}
    </div>
  );
}

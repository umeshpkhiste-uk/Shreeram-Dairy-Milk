'use client';

import { useState, useTransition } from 'react';

import { ErrorText, PrimaryButton } from '@/components/ui';

import { generateBillAction } from '../actions';

/** WhatsApp Web on a computer; on a phone the link opens the WhatsApp app. */
function whatsappUrl(phone: string, message: string) {
  const base = /Android|iPhone|iPad/i.test(navigator.userAgent)
    ? `https://wa.me/${phone}?`
    : `https://web.whatsapp.com/send?phone=${phone}&`;
  return `${base}text=${encodeURIComponent(message)}`;
}

export function GenerateBillButton({ billId, paid }: { billId: string; paid: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    // Opened during the click, or the browser blocks it as a pop-up.
    const chat = window.open('', '_blank');
    if (chat) chat.opener = null;
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateBillAction(billId, `${window.location.origin}/bill/${billId}`);
        if (result.error) throw new Error(result.error);
        const url = whatsappUrl(result.phone, result.message);
        if (chat) chat.location.href = url;
        else window.location.href = url;
      } catch (err) {
        chat?.close();
        setError(err instanceof Error ? err.message : 'Failed to generate the bill.');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <PrimaryButton type="button" disabled={pending || paid} onClick={generate}>
        {paid ? 'Bill paid' : pending ? 'Generating…' : 'Generate and send Bill'}
      </PrimaryButton>
      {error ? <ErrorText message={error} /> : null}
    </div>
  );
}

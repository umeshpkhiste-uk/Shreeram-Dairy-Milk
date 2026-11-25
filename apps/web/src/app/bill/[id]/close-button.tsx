'use client';

import { useState } from 'react';

import { DangerButton } from '@/components/ui';

export function CloseButton() {
  const [blocked, setBlocked] = useState(false);

  function close() {
    window.close();
    // Browsers refuse when the page was opened by typing or over another page.
    setTimeout(() => setBlocked(true), 500);
  }

  return (
    <div className="flex flex-col gap-1">
      <DangerButton type="button" onClick={close}>
        Close
      </DangerButton>
      {blocked ? (
        <p role="status" className="text-xs text-text-secondary">
          Your browser did not allow this. Please close this tab yourself.
        </p>
      ) : null}
    </div>
  );
}

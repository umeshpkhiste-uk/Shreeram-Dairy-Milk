'use client';

import { useActionState } from 'react';

import { ErrorText, PrimaryButton } from '@/components/ui';
import type { BusinessSettingsRow } from '@/lib/data/business-settings';

import type { SettingsActionState } from './actions';

const inputClass =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary';
const labelClass = 'flex flex-col gap-1 text-sm font-medium text-text';

export function BusinessSettingsForm({
  settings,
  action,
}: {
  settings: BusinessSettingsRow;
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Business name
          <input name="businessName" required defaultValue={settings.business_name} className={inputClass} />
        </label>
        <label className={labelClass}>
          Contact phone
          <input name="contactPhone" defaultValue={settings.contact_phone ?? ''} className={inputClass} />
        </label>
        <label className={labelClass}>
          Contact email
          <input name="contactEmail" defaultValue={settings.contact_email ?? ''} className={inputClass} />
        </label>
        <label className={labelClass}>
          Address
          <input name="address" defaultValue={settings.address ?? ''} className={inputClass} />
        </label>
        <label className={labelClass}>
          UPI ID (for order payment QR codes)
          <input
            name="upiId"
            placeholder="yourname@okaxis"
            defaultValue={settings.upi_id ?? ''}
            className={inputClass}
          />
        </label>
      </div>
      {state.error ? <ErrorText message={state.error} /> : null}
      <PrimaryButton type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : 'Save'}
      </PrimaryButton>
    </form>
  );
}

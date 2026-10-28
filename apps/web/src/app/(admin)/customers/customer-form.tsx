'use client';

import { useActionState } from 'react';

import type { CustomerRow } from '@/lib/data/customers';
import type { MilkTypeRow } from '@/lib/data/milk-types';
import type { WorkerSummary } from '@/lib/data/workers';

import { ErrorText, PrimaryButton } from '@/components/ui';

import type { CustomerActionState } from './actions';

type Props = {
  customer?: CustomerRow;
  milkTypes: MilkTypeRow[];
  workers: WorkerSummary[];
  action: (state: CustomerActionState, formData: FormData) => Promise<CustomerActionState>;
  submitLabel: string;
};

const inputClass =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary';
const labelClass = 'flex flex-col gap-1 text-sm font-medium text-text';

export function CustomerForm({ customer, milkTypes, workers, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Full name
          <input name="fullName" required defaultValue={customer?.full_name} className={inputClass} />
        </label>
        <label className={labelClass}>
          Mobile number
          <input
            name="mobileNumber"
            required
            defaultValue={customer?.mobile_number}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Email (optional)
          <input name="email" type="email" defaultValue={customer?.email ?? ''} className={inputClass} />
        </label>
        <label className={labelClass}>
          Milk type
          <select
            name="milkTypeId"
            required
            defaultValue={customer?.milk_type_id ?? ''}
            className={inputClass}
          >
            <option value="" disabled>
              Select a milk type
            </option>
            {milkTypes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelClass}>
        Address
        <textarea
          name="address"
          required
          defaultValue={customer?.address}
          rows={2}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Locality
          <input name="locality" defaultValue={customer?.locality ?? ''} className={inputClass} />
        </label>
        <label className={labelClass}>
          Landmark
          <input name="landmark" defaultValue={customer?.landmark ?? ''} className={inputClass} />
        </label>
        <label className={labelClass}>
          Preferred delivery window
          <input
            name="preferredDeliveryWindow"
            defaultValue={customer?.preferred_delivery_window ?? ''}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Daily quantity (ml)
          <input
            name="defaultDailyQuantityMl"
            type="number"
            min={1}
            required
            defaultValue={customer?.default_daily_quantity_ml}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Delivery start date
          <input
            name="deliveryStartDate"
            type="date"
            required
            defaultValue={customer?.delivery_start_date ?? new Date().toISOString().slice(0, 10)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Assigned worker
          <select
            name="assignedWorkerId"
            defaultValue={customer?.assigned_worker_id ?? ''}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.fullName}
                {w.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium text-text">Billing contact (optional)</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className={labelClass}>
            Name
            <input
              name="billingContactName"
              defaultValue={customer?.billing_contact_name ?? ''}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Phone
            <input
              name="billingContactPhone"
              defaultValue={customer?.billing_contact_phone ?? ''}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Account reference
            <input
              name="accountReference"
              defaultValue={customer?.account_reference ?? ''}
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>

      <label className={labelClass}>
        Notes
        <textarea name="notes" defaultValue={customer?.notes ?? ''} rows={2} className={inputClass} />
      </label>

      {state.error ? <ErrorText message={state.error} /> : null}

      <PrimaryButton type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : submitLabel}
      </PrimaryButton>
    </form>
  );
}

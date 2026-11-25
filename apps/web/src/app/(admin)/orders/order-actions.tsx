'use client';

import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';

import type { PaymentMethod } from '@shreeram/shared';

import {
  DangerButton,
  ErrorText,
  InfoButton,
  PrimaryButton,
  SecondaryButton,
} from '@/components/ui';

import {
  cancelOrderAction,
  changeWorkerAction,
  generateOrderPaymentQrAction,
  markOrderPaidAction,
  rescheduleOrderAction,
  setOrderPaymentMethodAction,
  type ActionState,
} from './actions';
import { OrderItemsEditor } from './order-items-editor';

type Product = { id: string; name: string; unit: 'litre' | 'kg' };
type SelectOption = { id: string; label: string };

type Panel = 'payment' | 'worker' | 'reschedule' | 'update' | 'cancel' | null;

const smallButtonClass = '!px-3 !py-1.5 text-xs';

export function OrderActions({
  orderId,
  paymentStatus,
  paymentMethod,
  products,
  workers,
  currentQuantitiesBaseUnit,
}: {
  orderId: string;
  paymentStatus: 'unpaid' | 'paid';
  paymentMethod: PaymentMethod | null;
  products: Product[];
  workers: SelectOption[];
  currentQuantitiesBaseUnit: Record<string, number>;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const close = () => setPanel(null);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        <PrimaryButton
          type="button"
          className={smallButtonClass}
          onClick={() => setPanel(panel === 'payment' ? null : 'payment')}
        >
          Proceed for payment
        </PrimaryButton>
        <InfoButton
          type="button"
          className={smallButtonClass}
          onClick={() => setPanel(panel === 'worker' ? null : 'worker')}
        >
          Change the worker
        </InfoButton>
        <InfoButton
          type="button"
          className={smallButtonClass}
          onClick={() => setPanel(panel === 'reschedule' ? null : 'reschedule')}
        >
          Reschedule the delivery
        </InfoButton>
        <InfoButton
          type="button"
          className={smallButtonClass}
          onClick={() => setPanel(panel === 'update' ? null : 'update')}
        >
          Update the order
        </InfoButton>
        <DangerButton
          type="button"
          className={smallButtonClass}
          onClick={() => setPanel(panel === 'cancel' ? null : 'cancel')}
        >
          Cancel the order
        </DangerButton>
        {panel ? (
          <SecondaryButton type="button" className={smallButtonClass} onClick={close}>
            Close
          </SecondaryButton>
        ) : null}
      </div>

      {panel === 'payment' ? (
        <PaymentPanel
          orderId={orderId}
          paymentStatus={paymentStatus}
          paymentMethod={paymentMethod}
          onDone={close}
        />
      ) : null}
      {panel === 'worker' ? <ChangeWorkerPanel orderId={orderId} workers={workers} onDone={close} /> : null}
      {panel === 'reschedule' ? <ReschedulePanel orderId={orderId} onDone={close} /> : null}
      {panel === 'update' ? (
        <OrderItemsEditor
          orderId={orderId}
          products={products}
          initialQuantitiesBaseUnit={currentQuantitiesBaseUnit}
          onDone={close}
        />
      ) : null}
      {panel === 'cancel' ? <CancelPanel orderId={orderId} onDone={close} /> : null}
    </div>
  );
}

function PaymentPanel({
  orderId,
  paymentStatus,
  paymentMethod,
  onDone,
}: {
  orderId: string;
  paymentStatus: 'unpaid' | 'paid';
  paymentMethod: PaymentMethod | null;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod | null>(paymentMethod);
  const [qr, setQr] = useState<{ dataUrl: string } | { error: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chooseMethod = (m: PaymentMethod) => {
    setMethod(m);
    setQr(null);
    startTransition(async () => {
      const result = await setOrderPaymentMethodAction(orderId, m);
      setError(result.error);
      if (result.error) setMethod(paymentMethod);
      else if (m === 'upi') setQr(await generateOrderPaymentQrAction(orderId));
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-surface-muted p-3">
      <p className="text-sm font-medium text-text">
        Payment status: {paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
        {paymentMethod ? ` · ${paymentMethod === 'upi' ? 'UPI' : 'Cash'}` : ''}
      </p>
      <div className="flex gap-2">
        <SecondaryButton
          type="button"
          className={method === 'cash' ? '!border-primary' : ''}
          onClick={() => chooseMethod('cash')}
        >
          Cash on delivery
        </SecondaryButton>
        <SecondaryButton
          type="button"
          className={method === 'upi' ? '!border-primary' : ''}
          onClick={() => chooseMethod('upi')}
        >
          Payment with barcode (UPI)
        </SecondaryButton>
      </div>

      {method === 'upi' ? (
        <div>
          {qr === null ? (
            pending ? (
              <p className="text-sm text-text-secondary">Generating QR code…</p>
            ) : null
          ) : 'error' in qr ? (
            <ErrorText message={qr.error} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, not an optimizable remote image
            <img src={qr.dataUrl} alt="UPI payment QR code" width={180} height={180} />
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {method ? (
          <PrimaryButton
            type="button"
            disabled={pending || paymentStatus === 'paid'}
            onClick={() =>
              startTransition(async () => {
                setError((await markOrderPaidAction(orderId, method)).error);
              })
            }
          >
            Mark as paid
          </PrimaryButton>
        ) : null}
        {paymentStatus === 'paid' ? (
          <InfoButton type="button" disabled>
            Bill paid
          </InfoButton>
        ) : (
          <Link href={`/orders/${orderId}/print`} target="_blank">
            <InfoButton type="button">Generate bill</InfoButton>
          </Link>
        )}
        <SecondaryButton type="button" onClick={onDone}>
          Close
        </SecondaryButton>
      </div>
      {error ? <ErrorText message={error} /> : null}
    </div>
  );
}

function ChangeWorkerPanel({
  orderId,
  workers,
  onDone,
}: {
  orderId: string;
  workers: SelectOption[];
  onDone: () => void;
}) {
  const boundAction = changeWorkerAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, { error: null });

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface-muted p-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        New worker
        <select
          name="workerId"
          required
          defaultValue=""
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        >
          <option value="" disabled>
            Select worker
          </option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </label>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </PrimaryButton>
      <SecondaryButton type="button" onClick={onDone}>
        Close
      </SecondaryButton>
      {state.error ? <ErrorText message={state.error} /> : null}
    </form>
  );
}

function ReschedulePanel({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const boundAction = rescheduleOrderAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, { error: null });

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface-muted p-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        New delivery date
        <input
          type="date"
          name="orderDate"
          required
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </label>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </PrimaryButton>
      <SecondaryButton type="button" onClick={onDone}>
        Close
      </SecondaryButton>
      {state.error ? <ErrorText message={state.error} /> : null}
    </form>
  );
}

function CancelPanel({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-danger bg-danger-bg p-3">
      <p className="text-sm text-danger">Cancel this order? This can&rsquo;t be undone.</p>
      <DangerButton
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelOrderAction(orderId);
            setError(result.error);
            if (!result.error) onDone();
          })
        }
      >
        {pending ? 'Cancelling…' : 'Confirm cancel'}
      </DangerButton>
      <SecondaryButton type="button" onClick={onDone}>
        Close
      </SecondaryButton>
      {error ? <ErrorText message={error} /> : null}
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BILL_STATUS_LABEL, BILL_STATUS_TONE, formatPaiseAsRupees } from '@shreeram/shared';

import { Badge, Card, PageHeader, SecondaryButton } from '@/components/ui';
import { getBillWithDetails } from '@/lib/data/bills';
import { getCustomer } from '@/lib/data/customers';
import { listAllMilkTypes } from '@/lib/data/milk-types';
import { createClient } from '@/lib/supabase/server';

import {
  acknowledgeBillFlagAction,
  addAdjustmentAction,
  finalizeBillAction,
  markBillSentAction,
  recalculateBillAction,
  recordPaymentAction,
  voidBillAction,
  voidPaymentAction,
} from '../actions';
import { AdjustmentForm } from './adjustment-form';
import { BackButton } from './back-button';
import { PaymentForm } from './payment-form';
import { VoidBillForm } from './void-bill-form';
import { VoidPaymentButton } from './void-payment-button';

type PageProps = { params: Promise<{ id: string }> };

export default async function BillDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const details = await getBillWithDetails(supabase, id);
  if (!details) notFound();
  const { bill, items, adjustments, payments } = details;

  const [customer, milkTypes] = await Promise.all([
    getCustomer(supabase, bill.customer_id),
    listAllMilkTypes(supabase),
  ]);
  const milkTypeNameById = new Map(milkTypes.map((m) => [m.id, m.name]));

  const totalPaid = payments.reduce((sum, p) => sum + p.amount_paise, 0);
  const isDraft = bill.status === 'draft';
  const isVoided = bill.status === 'voided';

  const boundVoid = voidBillAction.bind(null, id);
  const boundAddAdjustment = addAdjustmentAction.bind(null, id);
  const boundRecordPayment = recordPaymentAction.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Bill ${bill.bill_number}`}
        description={`${customer?.full_name ?? 'Customer'} · ${bill.billing_month}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BackButton />
            <Badge label={BILL_STATUS_LABEL[bill.status]} tone={BILL_STATUS_TONE[bill.status]} />
            {!isVoided ? (
              <Link
                href={`/billing/${id}/print`}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-muted"
              >
                Print / Save as PDF
              </Link>
            ) : null}
          </div>
        }
      />

      {bill.flagged_for_review ? (
        <Card className="border-warning bg-warning-bg">
          <p className="font-medium text-warning">Flagged for review</p>
          <p className="mt-1 text-sm text-warning">{bill.flagged_reason}</p>
          <form action={acknowledgeBillFlagAction.bind(null, id)} className="mt-3">
            <SecondaryButton type="submit">Acknowledge</SecondaryButton>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {isDraft ? (
            <form action={recalculateBillAction.bind(null, id)}>
              <SecondaryButton type="submit">Recalculate</SecondaryButton>
            </form>
          ) : null}
          {isDraft ? (
            <form action={finalizeBillAction.bind(null, id)}>
              <SecondaryButton type="submit">Finalize</SecondaryButton>
            </form>
          ) : null}
          {!isVoided ? (
            <form action={markBillSentAction.bind(null, id)}>
              <SecondaryButton type="submit" disabled={!!bill.sent_at}>
                {bill.sent_at ? `Sent ${bill.sent_at.slice(0, 10)}` : 'Mark as sent'}
              </SecondaryButton>
            </form>
          ) : null}
          {!isVoided ? <VoidBillForm action={boundVoid} /> : null}
        </div>

        <h2 className="mb-3 text-lg font-semibold text-text">Delivery breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-medium uppercase text-text-secondary">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Milk type</th>
                <th className="py-2 text-right">Quantity</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-text-secondary">
                    No billable deliveries this period.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2">{item.delivery_date}</td>
                    <td className="py-2">{milkTypeNameById.get(item.milk_type_id) ?? 'Milk'}</td>
                    <td className="py-2 text-right">{item.quantity_ml} ml</td>
                    <td className="py-2 text-right">{formatPaiseAsRupees(item.price_paise)}/L</td>
                    <td className="py-2 text-right">{formatPaiseAsRupees(item.amount_paise)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto max-w-xs text-sm">
          <Row label="Previous outstanding balance" value={bill.previous_outstanding_balance_paise} />
          <Row label="Delivery charges" value={bill.subtotal_paise} />
          <Row label="Adjustments" value={bill.adjustments_total_paise} />
          <Row label="Payments received" value={-totalPaid} />
          <Row label="Amount due" value={bill.total_payable_paise - totalPaid} strong />
        </div>
      </Card>

      {!isVoided ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-text">Adjustments</h2>
          <AdjustmentForm action={boundAddAdjustment} />
          {adjustments.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-1 text-sm text-text-secondary">
              {adjustments.map((a) => (
                <li key={a.id}>
                  {a.reason}: {formatPaiseAsRupees(a.amount_paise)}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {!isDraft && !isVoided ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-text">Payments</h2>
          <PaymentForm action={boundRecordPayment} />
          {payments.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">
                    {p.payment_date} · {p.method}
                    {p.transaction_reference ? ` · ${p.transaction_reference}` : ''} ·{' '}
                    {formatPaiseAsRupees(p.amount_paise)}
                    {p.voided_at ? ' (voided)' : ''}
                  </span>
                  {!p.voided_at ? (
                    <VoidPaymentButton billId={id} paymentId={p.id} action={voidPaymentAction} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between py-1 ${strong ? 'border-t border-text pt-2 font-bold' : 'text-text-secondary'}`}
    >
      <span>{label}</span>
      <span>{formatPaiseAsRupees(value)}</span>
    </div>
  );
}

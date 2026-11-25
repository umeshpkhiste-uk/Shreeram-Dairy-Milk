import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  BILL_STATUS_LABEL,
  BILL_STATUS_TONE,
  billAmountDue,
  daysDelivered,
  formatBillPeriod,
  formatBillingMonth,
  formatPaiseAsRupees,
  formatQuantityTotal,
  groupBillItems,
  lastOfMonth,
  todayInBusinessTimezone,
  unitLabel,
} from '@shreeram/shared';

import { ActionForm } from '@/components/action-form';
import { Badge, Card, DangerButton, PrimaryButton } from '@/components/ui';
import { getBillDocument, getBillWithDetails, listUnbilledMonths } from '@/lib/data/bills';
import { listPendingPaymentClaims } from '@/lib/data/payments';
import { createClient } from '@/lib/supabase/server';

import {
  acknowledgeBillFlagAction,
  addAdjustmentAction,
  cancelBillAction,
  recordPaymentAction,
  resolvePaymentClaimAction,
  voidPaymentAction,
} from '../actions';
import { AdjustmentForm } from './adjustment-form';
import { BackButton } from './back-button';
import { CancelBillForm } from './cancel-bill-form';
import { GenerateBillButton } from './generate-bill-button';
import { PaymentForm } from './payment-form';
import { VoidPaymentButton } from './void-payment-button';

type PageProps = { params: Promise<{ id: string }> };

export default async function BillDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [details, document, claims] = await Promise.all([
    getBillWithDetails(supabase, id),
    getBillDocument(supabase, id),
    listPendingPaymentClaims(supabase, id),
  ]);
  if (!details || !document) notFound();
  const { bill, adjustments, payments } = details;
  const { items } = document;
  const unbilled = (await listUnbilledMonths(supabase, '2000-01-01', bill.customer_id)).filter(
    (u) => u.billing_month < bill.billing_month,
  );

  const totalPaid = payments.reduce((sum, p) => (p.voided_at ? sum : sum + p.amount_paise), 0);
  const { duePaise, settledElsewherePaise } = billAmountDue(
    bill.status,
    bill.total_payable_paise,
    totalPaid,
  );
  const isDraft = bill.status === 'draft';
  const isVoided = bill.status === 'voided';
  // Days after a bill paid mid-month still have to be billed, and a flagged bill generated again.
  const today = todayInBusinessTimezone();
  const monthEnd = lastOfMonth(bill.billing_month);
  const isPaid =
    bill.status === 'paid' &&
    !bill.flagged_for_review &&
    document.bill.billedThrough >= (today < monthEnd ? today : monthEnd);

  const boundAddAdjustment = addAdjustmentAction.bind(null, id);
  const boundRecordPayment = recordPaymentAction.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl font-semibold text-text">Bill {bill.bill_number}</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {document.customer.fullName} ·{' '}
              {formatBillPeriod(bill.billing_month, document.bill.billedThrough)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={BILL_STATUS_LABEL[bill.status]} tone={BILL_STATUS_TONE[bill.status]} />
          {!isVoided ? (
            <GenerateBillButton billId={id} paid={isPaid} />
          ) : null}
        </div>
      </div>

      {bill.flagged_for_review ? (
        <Card className="border-warning bg-warning-bg">
          <p className="font-medium text-warning">Flagged for review</p>
          <p className="mt-1 text-sm text-warning">{bill.flagged_reason}</p>
          <ActionForm action={acknowledgeBillFlagAction.bind(null, id)} className="mt-3">
            <PrimaryButton type="submit">Acknowledge</PrimaryButton>
          </ActionForm>
        </Card>
      ) : null}

      {document.includedIn ? (
        <Card className="border-warning bg-warning-bg">
          <p className="text-sm text-text">
            This balance is already included in bill {document.includedIn}. The customer should pay
            that one.
          </p>
        </Card>
      ) : null}

      {unbilled.map((u) => (
        <Card key={u.billing_month} className="border-warning bg-warning-bg">
          <p className="text-sm text-text">
            There is no bill for {formatBillingMonth(u.billing_month)}, so its{' '}
            {formatPaiseAsRupees(u.amount_paise)} is not in this bill.{' '}
            <Link
              href={`/billing?month=${u.billing_month}`}
              className="font-medium text-primary hover:underline"
            >
              Create it
            </Link>
          </p>
        </Card>
      ))}

      {claims.map((claim) => (
        <Card key={claim.id} className="border-warning bg-warning-bg">
          <p className="font-medium text-warning">
            The customer says {formatPaiseAsRupees(claim.amount_paise)} was paid by UPI
          </p>
          <p className="mt-1 text-sm text-text">
            Due on this bill: {formatPaiseAsRupees(duePaise)}. Transaction number{' '}
            {claim.transaction_reference}. Check it in your bank or UPI app before
            you confirm.
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <ActionForm action={resolvePaymentClaimAction.bind(null, id, claim.id, true)}>
              <PrimaryButton type="submit">Payment received</PrimaryButton>
            </ActionForm>
            <ActionForm action={resolvePaymentClaimAction.bind(null, id, claim.id, false)}>
              <DangerButton type="submit">Not received</DangerButton>
            </ActionForm>
          </div>
        </Card>
      ))}

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Delivery summary</h2>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Days delivered" value={String(daysDelivered(items))} />
          <Stat
            label="Total quantity"
            value={formatQuantityTotal(items.map((i) => ({ quantity: i.quantityMl, unit: i.unit })))}
          />
          <Stat
            label="Days customer informed, no delivery"
            value={String(document.noDeliveryDays)}
          />
        </div>

        <h2 className="mb-3 text-lg font-semibold text-text">Delivery breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-medium uppercase text-text-secondary">
              <tr>
                <th className="py-2">Product type</th>
                <th className="py-2 text-right">Total days delivery</th>
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
                groupBillItems(items).map((line) => (
                  <tr key={`${line.milkTypeName}-${line.pricePaise}-${line.detail}`}>
                    <td className="py-2">
                      {line.milkTypeName}
                      {line.detail ? (
                        <span className="block text-xs text-text-secondary">{line.detail}</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right">{line.days}</td>
                    <td className="py-2 text-right">
                      {formatQuantityTotal([{ quantity: line.quantityMl, unit: line.unit }])}
                    </td>
                    <td className="py-2 text-right">
                      {formatPaiseAsRupees(line.pricePaise)}/{unitLabel(line.unit)}
                    </td>
                    <td className="py-2 text-right">{formatPaiseAsRupees(line.amountPaise)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto max-w-xs text-sm">
          <Row label="Previous outstanding balance" value={bill.previous_outstanding_balance_paise} />
          <Row label="Current Month Charges" value={bill.subtotal_paise} />
          <Row label="Adjustments" value={bill.adjustments_total_paise} />
          <Row label="Payments received" value={-totalPaid} />
          {settledElsewherePaise > 0 ? (
            <Row label="Settled on another bill" value={-settledElsewherePaise} />
          ) : null}
          <Row label="Total Amount to be Paid" value={duePaise} strong />
        </div>
      </Card>

      {!isVoided ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-text">Adjustments</h2>
          <div className="flex flex-wrap items-end gap-3">
            <AdjustmentForm action={boundAddAdjustment} />
            {isDraft ? (
              <CancelBillForm action={cancelBillAction.bind(null, id, bill.billing_month)} />
            ) : null}
          </div>
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
          <PaymentForm key={payments.length} action={boundRecordPayment} duePaise={duePaise} />
          {payments.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">
                    {p.payment_date} · {p.method}
                    {p.transaction_reference ? ` · ${p.transaction_reference}` : ''} ·{' '}
                    {formatPaiseAsRupees(p.amount_paise)}
                    {p.voided_at ? ' (undone)' : ''}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-muted px-3 py-2">
      <p className="text-xl font-semibold text-text">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
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

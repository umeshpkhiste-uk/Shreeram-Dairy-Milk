import { BILL_STYLE, formatPaiseAsRupees } from '@shreeram/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PrintButton } from '@/components/print-button';
import { getBusinessSettings } from '@/lib/data/business-settings';
import { listBillsForMonth } from '@/lib/data/bills';
import { listCustomers } from '@/lib/data/customers';
import { listPaymentsForBillIds } from '@/lib/data/payments';
import { createClient } from '@/lib/supabase/server';

import { buildBillingSummaryRows, sumBillingSummaryTotals } from '../billing-summary';

type PageProps = { searchParams: Promise<{ month?: string }> };

function monthLabel(month: string): string {
  return new Date(`${month}T00:00:00Z`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The billing-summary report's PDF — same browser-print mechanism as the
 * bill/order PDFs. Report generation is PDF everywhere in this app, no
 * CSV/other export format (see docs/web-admin.md).
 */
export default async function ReportsPrintPage({ searchParams }: PageProps) {
  const { month } = await searchParams;
  if (!month || !/^\d{4}-\d{2}-01$/.test(month)) notFound();

  const supabase = await createClient();
  const [bills, customers, business] = await Promise.all([
    listBillsForMonth(supabase, month),
    listCustomers(supabase, { status: 'all' }),
    getBusinessSettings(supabase),
  ]);
  const payments = await listPaymentsForBillIds(supabase, bills.map((b) => b.id));
  const rows = buildBillingSummaryRows(bills, customers, payments);
  const totals = sumBillingSummaryTotals(rows);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <style dangerouslySetInnerHTML={{ __html: BILL_STYLE }} />
      <div className="no-print mb-4 flex justify-between">
        {/* Not BackButton: this page opens in a new tab, which has no history to go back to. */}
        <Link
          href={`/reports?month=${month}`}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-muted"
        >
          ← Back
        </Link>
        <PrintButton />
      </div>
      <div className="bill-doc rounded-lg border border-border bg-white p-8">
        <div className="header">
          <div className="business">
            {/* eslint-disable-next-line @next/next/no-img-element -- static public asset embedded in a print document */}
            <img className="logo" src="/logo.png" alt="" />
            <div>
              <h1>{business.business_name}</h1>
              <div className="muted">
                {business.address ? (
                  <>
                    {business.address}
                    <br />
                  </>
                ) : null}
                {business.contact_phone ? `${business.contact_phone} · ` : ''}
                {business.contact_email ?? ''}
              </div>
            </div>
          </div>
          <div>
            <div>
              <strong>Billing Summary</strong>
            </div>
            <div className="muted">{monthLabel(month)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Bill</th>
              <th className="num">Previous balance</th>
              <th className="num">Billed this month</th>
              <th className="num">Paid</th>
              <th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>No bills for this month yet.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.billId}>
                  <td>{r.customerName}</td>
                  <td>{r.billNumber}</td>
                  <td className="num">{formatPaiseAsRupees(r.previousPaise)}</td>
                  <td className="num">{formatPaiseAsRupees(r.billedPaise)}</td>
                  <td className="num">{formatPaiseAsRupees(r.paidPaise)}</td>
                  <td className="num">{formatPaiseAsRupees(r.outstandingPaise)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <table className="totals">
          <tbody>
            <tr>
              <td className="label">Previous balance</td>
              <td className="num">{formatPaiseAsRupees(totals.previous)}</td>
            </tr>
            <tr>
              <td className="label">Billed this month</td>
              <td className="num">{formatPaiseAsRupees(totals.billed)}</td>
            </tr>
            <tr>
              <td className="label">Paid</td>
              <td className="num">{formatPaiseAsRupees(totals.paid)}</td>
            </tr>
            <tr className="grand">
              <td>Outstanding</td>
              <td className="num">{formatPaiseAsRupees(totals.outstanding)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

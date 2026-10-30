import { BILL_STYLE, formatPaiseAsRupees } from '@shreeram/shared';
import { notFound } from 'next/navigation';

import { getBusinessSettings } from '@/lib/data/business-settings';
import { listBillsForMonth } from '@/lib/data/bills';
import { listCustomers } from '@/lib/data/customers';
import { listPaymentsForBillIds } from '@/lib/data/payments';
import { createClient } from '@/lib/supabase/server';

import { buildBillingSummaryRows, sumBillingSummaryTotals } from '../billing-summary';
import { PrintButton } from '../../billing/[id]/print/print-button';

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
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <div className="bill-doc rounded-lg border border-border bg-white p-8">
        <div className="header">
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
              <th className="num">Billed</th>
              <th className="num">Paid</th>
              <th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>No bills for this month yet.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.billId}>
                  <td>{r.customerName}</td>
                  <td>{r.billNumber}</td>
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
              <td className="label">Billed</td>
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

import { firstOfMonth, formatPaiseAsRupees, shiftMonth, todayInBusinessTimezone } from '@shreeram/shared';
import Link from 'next/link';

import { Card, EmptyState, PageHeader, Table } from '@/components/ui';
import { listBillsForMonth } from '@/lib/data/bills';
import { listCustomers } from '@/lib/data/customers';
import { listPaymentsForBillIds } from '@/lib/data/payments';
import { createClient } from '@/lib/supabase/server';

import { buildBillingSummaryRows, sumBillingSummaryTotals } from './billing-summary';

type PageProps = { searchParams: Promise<{ month?: string }> };

export default async function ReportsPage({ searchParams }: PageProps) {
  const { month: monthParam } = await searchParams;
  const month = firstOfMonth(monthParam ?? todayInBusinessTimezone());
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const supabase = await createClient();
  const [bills, customers] = await Promise.all([
    listBillsForMonth(supabase, month),
    listCustomers(supabase, { status: 'all' }),
  ]);
  const payments = await listPaymentsForBillIds(supabase, bills.map((b) => b.id));
  const rows = buildBillingSummaryRows(bills, customers, payments);
  const totals = sumBillingSummaryTotals(rows);

  return (
    <div>
      <PageHeader
        title="Reports"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/reports?month=${prevMonth}`}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted"
            >
              ‹
            </Link>
            <span className="px-2 text-sm font-medium text-text">{month}</span>
            <Link
              href={`/reports?month=${nextMonth}`}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted"
            >
              ›
            </Link>
            <Link
              href={`/reports/print?month=${month}`}
              target="_blank"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-hover"
            >
              Print / Save as PDF
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <p className="text-sm text-text-secondary">
          Billed {formatPaiseAsRupees(totals.billed)} · Paid {formatPaiseAsRupees(totals.paid)} ·
          Outstanding {formatPaiseAsRupees(totals.outstanding)}
        </p>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No bills for this month yet" />
      ) : (
        <Table>
          <thead className="bg-surface-muted text-xs font-medium uppercase text-text-secondary">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Bill</th>
              <th className="px-4 py-3">Billed</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.billId} className="hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium text-text">{r.customerName}</td>
                <td className="px-4 py-3 text-text-secondary">{r.billNumber}</td>
                <td className="px-4 py-3">{formatPaiseAsRupees(r.billedPaise)}</td>
                <td className="px-4 py-3">{formatPaiseAsRupees(r.paidPaise)}</td>
                <td className="px-4 py-3">{formatPaiseAsRupees(r.outstandingPaise)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

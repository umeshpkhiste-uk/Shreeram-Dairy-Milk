import { firstOfMonth, formatPaiseAsRupees, shiftMonth, todayInBusinessTimezone } from '@shreeram/shared';
import Link from 'next/link';

import { Card, EmptyState, PageHeader, Table } from '@/components/ui';
import { listBillsForMonth } from '@/lib/data/bills';
import { listCustomers } from '@/lib/data/customers';
import { listPaymentsForBillIds } from '@/lib/data/payments';
import { createClient } from '@/lib/supabase/server';

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
  const customerNameById = new Map(customers.map((c) => [c.id, c.full_name]));
  const paidByBillId = new Map<string, number>();
  for (const p of payments) {
    paidByBillId.set(p.bill_id, (paidByBillId.get(p.bill_id) ?? 0) + p.amount_paise);
  }

  const rows = bills.map((b) => {
    const paid = paidByBillId.get(b.id) ?? 0;
    return {
      billId: b.id,
      customerName: customerNameById.get(b.customer_id) ?? 'Unknown customer',
      billNumber: b.bill_number,
      billedPaise: b.total_payable_paise,
      paidPaise: paid,
      outstandingPaise: b.total_payable_paise - paid,
    };
  });
  const totals = rows.reduce(
    (acc, r) => ({
      billed: acc.billed + r.billedPaise,
      paid: acc.paid + r.paidPaise,
      outstanding: acc.outstanding + r.outstandingPaise,
    }),
    { billed: 0, paid: 0, outstanding: 0 },
  );

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
            <a
              href={`/api/reports/billing-summary?month=${month}`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-hover"
            >
              Export CSV
            </a>
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

import Link from 'next/link';

import { firstOfMonth, formatPaiseAsRupees, shiftMonth, todayInBusinessTimezone } from '@shreeram/shared';

import { Badge, PageHeader, Table } from '@/components/ui';
import { listBillsForMonth } from '@/lib/data/bills';
import { listCustomers } from '@/lib/data/customers';
import { createClient } from '@/lib/supabase/server';

import { createDraftBillAction } from './actions';

type PageProps = { searchParams: Promise<{ month?: string }> };

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'neutral',
  finalized: 'info',
  partially_paid: 'warning',
  paid: 'success',
  voided: 'danger',
};

export default async function BillingListPage({ searchParams }: PageProps) {
  const { month: monthParam } = await searchParams;
  const month = firstOfMonth(monthParam ?? todayInBusinessTimezone());
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const supabase = await createClient();
  const [customers, bills] = await Promise.all([
    listCustomers(supabase, { status: 'active' }),
    listBillsForMonth(supabase, month),
  ]);
  const billByCustomerId = new Map(bills.map((b) => [b.customer_id, b]));

  return (
    <div>
      <PageHeader
        title="Billing"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/billing?month=${prevMonth}`}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted"
            >
              ‹
            </Link>
            <span className="px-2 text-sm font-medium text-text">{month}</span>
            <Link
              href={`/billing?month=${nextMonth}`}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted"
            >
              ›
            </Link>
          </div>
        }
      />

      <Table>
        <thead className="bg-surface-muted text-xs font-medium uppercase text-text-secondary">
          <tr>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Bill</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Total payable</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {customers.map((customer) => {
            const bill = billByCustomerId.get(customer.id);
            return (
              <tr key={customer.id} className="hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium text-text">{customer.full_name}</td>
                <td className="px-4 py-3 text-text-secondary">{bill?.bill_number ?? '—'}</td>
                <td className="px-4 py-3">
                  {bill ? (
                    <Badge label={bill.status} tone={STATUS_TONE[bill.status]} />
                  ) : (
                    <Badge label="Not created" tone="neutral" />
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {bill ? formatPaiseAsRupees(bill.total_payable_paise) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {bill ? (
                    <Link href={`/billing/${bill.id}`} className="font-medium text-primary">
                      View
                    </Link>
                  ) : (
                    <form action={createDraftBillAction.bind(null, customer.id, month)}>
                      <button type="submit" className="font-medium text-primary hover:underline">
                        Create bill
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

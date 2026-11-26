import Link from 'next/link';

import {
  firstOfMonth,
  formatBillingMonth,
  formatPaiseAsRupees,
  shiftMonth,
  todayInBusinessTimezone,
} from '@shreeram/shared';

import { ActionForm } from '@/components/action-form';
import { Badge, buttonClass, PageHeader, PrimaryButton, Table } from '@/components/ui';
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
  const [allCustomers, bills] = await Promise.all([
    listCustomers(supabase, { status: 'all' }),
    listBillsForMonth(supabase, month),
  ]);
  const billByCustomerId = new Map(bills.map((b) => [b.customer_id, b]));
  // An inactive customer may still owe for days before they stopped.
  const customers = allCustomers.filter(
    (c) => c.status === 'active' || billByCustomerId.has(c.id) || c.updated_at >= month,
  );

  return (
    <div>
      <PageHeader
        title="Billing"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/billing?month=${prevMonth}`}
              className={buttonClass('secondary')}
            >
              ‹
            </Link>
            <span className="px-2 text-sm font-medium text-text">{formatBillingMonth(month)}</span>
            <Link
              href={`/billing?month=${nextMonth}`}
              className={buttonClass('secondary')}
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
                <td className="px-4 py-3 font-medium text-text">
                  {customer.full_name}
                  {customer.status === 'active' ? '' : ' (inactive)'}
                </td>
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
                    <Link href={`/billing/${bill.id}`} className={`inline-block ${buttonClass('info')}`}>
                      View
                    </Link>
                  ) : (
                    <ActionForm
                      key={month}
                      action={createDraftBillAction.bind(null, customer.id, month)}
                    >
                      <PrimaryButton type="submit">Create bill</PrimaryButton>
                    </ActionForm>
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

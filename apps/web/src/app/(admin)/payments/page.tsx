import Link from 'next/link';

import { formatPaiseAsRupees } from '@shreeram/shared';

import { EmptyState, PageHeader, Table } from '@/components/ui';
import { listRecentPayments } from '@/lib/data/payments';
import { createClient } from '@/lib/supabase/server';

export default async function PaymentsPage() {
  const supabase = await createClient();
  const payments = await listRecentPayments(supabase, 100);

  return (
    <div>
      <PageHeader title="Payments" description="The 100 most recently recorded payments, across all customers." />
      {payments.length === 0 ? (
        <EmptyState title="No payments recorded yet" />
      ) : (
        <Table>
          <thead className="bg-surface-muted text-xs font-medium uppercase text-text-secondary">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Bill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-surface-muted">
                <td className="px-4 py-3">{p.payment_date}</td>
                <td className="px-4 py-3 text-text-secondary">{p.method}</td>
                <td className="px-4 py-3 text-text-secondary">{p.transaction_reference ?? '—'}</td>
                <td className="px-4 py-3">
                  {formatPaiseAsRupees(p.amount_paise)}
                  {p.voided_at ? ' (voided)' : ''}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/billing/${p.bill_id}`} className="font-medium text-primary">
                    View bill
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

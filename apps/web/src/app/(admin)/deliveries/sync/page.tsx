import Link from 'next/link';

import { formatQuantity } from '@shreeram/shared';

import { ActionForm } from '@/components/action-form';
import { Badge, Card, EmptyState, PageHeader, SecondaryButton, Table, WarningButton } from '@/components/ui';
import { listCustomers } from '@/lib/data/customers';
import { listAllMilkTypes } from '@/lib/data/milk-types';
import { listReceivedRecords, listSyncFailures } from '@/lib/data/sync';
import { listWorkers } from '@/lib/data/workers';
import { createClient } from '@/lib/supabase/server';

import { dismissSyncFailureAction } from './actions';

const STATUS_LABEL: Record<string, string> = {
  completed: 'Delivered',
  partial: 'Partial',
  missed: 'Missed',
  skipped: 'Customer informed',
};

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function dateInIndia(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** What workers' phones sent, when, and what could not be saved. */
export default async function WorkerSyncPage() {
  const supabase = await createClient();
  const [failures, records, workers, customers, milkTypes] = await Promise.all([
    listSyncFailures(supabase),
    listReceivedRecords(supabase, 200),
    listWorkers(supabase),
    listCustomers(supabase, { status: 'all' }),
    listAllMilkTypes(supabase),
  ]);
  const workerName = new Map(workers.map((w) => [w.id, w.fullName]));
  const customerName = new Map(customers.map((c) => [c.id, c.full_name]));
  const productById = new Map(milkTypes.map((m) => [m.id, m]));
  const lastReceived = new Map<string, string>();
  for (const r of records) {
    if (!lastReceived.has(r.worker_id)) lastReceived.set(r.worker_id, r.server_received_at);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Worker sync"
        description="What workers’ phones sent. A record that is still only on a phone shows here after that phone syncs."
        actions={
          <Link href="/deliveries">
            <SecondaryButton type="button">Back to Deliveries</SecondaryButton>
          </Link>
        }
      />

      {failures.length > 0 ? (
        <Card className="border-danger">
          <h2 className="mb-3 text-lg font-semibold text-danger">Not saved</h2>
          <p className="mb-4 text-sm text-text-secondary">
            These are still on the worker&rsquo;s phone, which tries again every few hours. Bills
            treat these days as if nothing was recorded. If one can&rsquo;t be corrected, adjust the
            bill and dismiss it.
          </p>
          <ul className="flex flex-col gap-4">
            {failures.map((f) => {
              const p = f.payload as Record<string, string | number | null>;
              const product = productById.get(String(p.milkTypeId));
              return (
                <li key={f.event_id} className="flex flex-wrap items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-text">
                      {customerName.get(String(p.customerId)) ?? 'Customer'} · {String(p.deliveryDate)} ·{' '}
                      {product?.name ?? 'Product'} ·{' '}
                      {STATUS_LABEL[String(p.status)] ?? String(p.status)}{' '}
                      {formatQuantity(Number(p.deliveredQuantityMl ?? 0), product?.unit)}
                    </p>
                    <p className="text-text-secondary">
                      {workerName.get(f.worker_id) ?? 'Worker'}, reported {dateTime(f.reported_at)}
                    </p>
                    <p className="text-danger">{f.error}</p>
                  </div>
                  <ActionForm action={dismissSyncFailureAction.bind(null, f.event_id)}>
                    <WarningButton type="submit">Dismiss</WarningButton>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Last record from each worker</h2>
        <ul className="flex flex-col gap-1 text-sm text-text-secondary">
          {workers.map((w) => {
            const last = lastReceived.get(w.id);
            return (
              <li key={w.id}>
                {w.fullName}
                {w.isActive ? '' : ' (inactive)'}: {last ? dateTime(last) : 'none in the list below'}
              </li>
            );
          })}
        </ul>
      </Card>

      {records.length === 0 ? (
        <EmptyState title="Nothing received yet" />
      ) : (
        <Table>
          <thead className="bg-surface-muted text-xs font-medium uppercase text-text-secondary">
            <tr>
              <th className="px-4 py-3">Delivery date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Record</th>
              <th className="px-4 py-3">Worker</th>
              <th className="px-4 py-3">Recorded on phone</th>
              <th className="px-4 py-3">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records.map((r) => {
              const date = String(r.payload.delivery_date);
              const product = productById.get(String(r.payload.milk_type_id));
              return (
                <tr key={r.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link
                      href={`/deliveries/${r.customer_id}?month=${date.slice(0, 7)}-01&day=${date}`}
                      className="font-medium text-primary"
                    >
                      {date}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{customerName.get(r.customer_id) ?? 'Customer'}</td>
                  <td className="px-4 py-3">{product?.name ?? 'Product'}</td>
                  <td className="px-4 py-3">
                    {STATUS_LABEL[String(r.payload.status)] ?? String(r.payload.status)}{' '}
                    {formatQuantity(Number(r.payload.delivered_quantity_ml), product?.unit)}
                    {r.event_type === 'corrected' ? ' (correction)' : ''}
                  </td>
                  <td className="px-4 py-3">{workerName.get(r.worker_id) ?? 'Worker'}</td>
                  <td className="px-4 py-3">{dateTime(r.device_recorded_at)}</td>
                  <td className="px-4 py-3">
                    {dateTime(r.server_received_at)}{' '}
                    {r.conflict ? (
                      <Badge label="Conflict" tone="danger" />
                    ) : dateInIndia(r.server_received_at) > date ? (
                      <Badge label="Synced late" tone="warning" />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}

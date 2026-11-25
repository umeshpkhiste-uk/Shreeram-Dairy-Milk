'use client';

import { formatQuantity, formatQuantityTotal, type StatusTone } from '@shreeram/shared';

import {
  Badge,
  Button,
  Card,
  DELIVERY_STATUS_LABEL,
  DELIVERY_STATUS_TONE,
  EmptyState,
  LoadingState,
  Row,
  Title,
} from '@/components/ui';
import { getCachedMilkTypes, listCachedCustomers } from '@/lib/db/cache-repo';
import type { OutboxStatus } from '@/lib/db/db';
import { listLocalDeliveriesForDate } from '@/lib/db/deliveries-repo';
import { listOutboxItems, retryFailedOutboxItem } from '@/lib/db/outbox-repo';
import { useLive } from '@/lib/db/use-live';
import { useIsOnline } from '@/lib/sync/connectivity';
import { runSync, useSyncStatus } from '@/lib/sync/sync-engine';
import { summarizeTodayDeliveries } from '@/lib/sync/today-summary';
import { useToday } from '@/lib/use-today';

const OUTBOX_STATUS_LABEL: Record<OutboxStatus, string> = {
  pending: 'Waiting to sync',
  in_flight: 'Syncing…',
  done: 'Synced',
  failed: 'Failed — needs review',
};
const OUTBOX_STATUS_TONE: Record<OutboxStatus, StatusTone> = {
  pending: 'neutral',
  in_flight: 'info',
  done: 'success',
  failed: 'danger',
};

export default function SyncStatusPage() {
  const status = useSyncStatus();
  const isOnline = useIsOnline();
  const today = useToday();
  const data = useLive(
    async () =>
      today === null
        ? undefined
        : {
            items: await listOutboxItems(),
            customers: await listCachedCustomers(),
            deliveries: await listLocalDeliveriesForDate(today),
            milkTypes: await getCachedMilkTypes(),
          },
    [today],
  );

  if (!data || !today) return <LoadingState label="Loading sync status…" />;

  const summary = summarizeTodayDeliveries(data.customers, data.deliveries);
  const deliveredByProduct = Object.entries(summary.deliveredMlByMilkType).map(
    ([id, quantity]) => [id, { quantity, unit: data.milkTypes[id]?.unit }] as const,
  );
  const deliveryByCustomerId = new Map(data.deliveries.map((d) => [d.customer_id, d]));

  async function handleRetry(eventId: string) {
    await retryFailedOutboxItem(eventId);
    await runSync();
  }

  return (
    <>
      <Title>Sync Status</Title>

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          Today&rsquo;s deliveries · {today.split('-').reverse().join('/')}
        </h2>
        <p className="text-sm text-text-secondary">Check these numbers before you sync.</p>
        <dl className="grid grid-cols-3 gap-y-2">
          <Stat label="Customers" value={summary.totalCustomers} />
          <Stat label="Delivered" value={summary.delivered} />
          <Stat label="Partial" value={summary.partial} />
          <Stat label="Missed" value={summary.missed} />
          <Stat label="Customer informed" value={summary.skipped} />
          <Stat label="Not recorded yet" value={summary.notRecorded} />
        </dl>
        <Row
          label="Scheduled quantity"
          value={formatQuantityTotal(
            data.customers.map((c) => ({
              quantity: c.default_daily_quantity_ml,
              unit: data.milkTypes[c.milk_type_id]?.unit,
            })),
          )}
        />
        <Row
          label="Delivered quantity"
          value={formatQuantityTotal(deliveredByProduct.map(([, total]) => total))}
        />
        {deliveredByProduct.map(([milkTypeId, total]) => (
          <Row
            key={milkTypeId}
            label={data.milkTypes[milkTypeId]?.name ?? 'Product'}
            value={formatQuantityTotal([total])}
          />
        ))}
        <Row label="Synced to server" value={summary.synced} />
        <Row label="Waiting to sync" value={summary.waitingToSync} />
      </Card>

      {data.customers.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Customer-wise check</h2>
          {data.customers.map((customer) => {
            const delivery = deliveryByCustomerId.get(customer.id);
            const unit =
              data.milkTypes[delivery?.milk_type_id ?? customer.milk_type_id]?.unit;
            return (
              <div key={customer.id} className="flex items-center justify-between gap-2 py-1">
                <div>
                  <p>{customer.full_name}</p>
                  <p className="text-sm text-text-secondary">
                    {delivery
                      ? `${delivery.delivered_quantity_ml} of ${formatQuantity(delivery.scheduled_quantity_ml, unit)}` +
                        (delivery.sync_status === 'synced' ? ' · synced' : ' · not synced yet')
                      : `${formatQuantity(customer.default_daily_quantity_ml, unit)} scheduled`}
                  </p>
                </div>
                <Badge
                  label={delivery ? DELIVERY_STATUS_LABEL[delivery.status] : 'Not recorded'}
                  tone={delivery ? DELIVERY_STATUS_TONE[delivery.status] : 'neutral'}
                />
              </div>
            );
          })}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2">
        <Row label="Connection" value={isOnline ? 'Online' : 'Offline'} />
        <Row label="Pending" value={status.pendingCount} />
        <Row label="Failed" value={status.failedCount} />
        <Row
          label="Last synced"
          value={status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : 'Never'}
        />
        {status.lastError ? <Row label="Last error" value={status.lastError} /> : null}
        <Button onClick={() => runSync()} disabled={!isOnline || status.phase === 'syncing'}>
          {status.phase === 'syncing' ? 'Syncing…' : 'Sync now'}
        </Button>
      </Card>

      {data.items.length === 0 ? (
        <EmptyState
          title="Nothing queued"
          description="Deliveries you record will appear here until synced."
        />
      ) : (
        data.items.map((item) => (
          <Card key={item.event_id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {item.event_type === 'created' ? 'New delivery' : 'Correction'}
              </span>
              <Badge
                label={OUTBOX_STATUS_LABEL[item.status]}
                tone={OUTBOX_STATUS_TONE[item.status]}
              />
            </div>
            <p className="text-sm text-text-secondary">
              Attempt {item.attempt_count + 1} · recorded{' '}
              {new Date(item.created_at).toLocaleString()}
            </p>
            {item.last_error ? <p className="text-sm text-danger">{item.last_error}</p> : null}
            {item.status === 'failed' ? (
              <Button variant="info" onClick={() => handleRetry(item.event_id)}>
                Retry
              </Button>
            ) : null}
          </Card>
        ))
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}

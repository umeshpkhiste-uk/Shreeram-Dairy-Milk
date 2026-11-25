'use client';

import { dayProducts, dayStatus, formatQuantity } from '@shreeram/shared';

import {
  Badge,
  Button,
  Card,
  DELIVERY_STATUS_LABEL,
  DELIVERY_STATUS_TONE,
  EmptyState,
  ErrorText,
  LoadingState,
  Title,
} from '@/components/ui';
import { getCachedMilkTypes, listCachedCustomers } from '@/lib/db/cache-repo';
import { listLocalDeliveriesForDate } from '@/lib/db/deliveries-repo';
import { useLive } from '@/lib/db/use-live';
import { runSync, useSyncStatus } from '@/lib/sync/sync-engine';
import { useToday } from '@/lib/use-today';

/** Selection only — a delivery is marked on the customer's calendar (today/customer). */
export default function TodayRoutePage() {
  const today = useToday();
  const sync = useSyncStatus();
  const data = useLive(
    async () =>
      today === null
        ? undefined
        : {
            customers: await listCachedCustomers(),
            milkTypes: await getCachedMilkTypes(),
            deliveries: await listLocalDeliveriesForDate(today),
          },
    [today],
  );

  if (!data || (data.customers.length === 0 && sync.phase === 'syncing')) {
    return <LoadingState label="Loading today’s route…" />;
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Title>Today&rsquo;s Route</Title>
        <Button
          variant="info"
          onClick={() => runSync()}
          disabled={sync.phase === 'syncing' || sync.phase === 'offline'}
        >
          {sync.phase === 'syncing' ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
      {sync.lastError ? <ErrorText message={sync.lastError} /> : null}
      {data.customers.length === 0 ? (
        sync.lastSyncedAt ? (
          <EmptyState
            title="No customers assigned"
            description="Ask an admin to assign customers to your route."
          />
        ) : (
          <EmptyState
            title="Route not downloaded yet"
            description="Connect to the internet once to download your route."
          />
        )
      ) : (
        data.customers.map((customer) => {
          const products = dayProducts(
            customer,
            data.deliveries.filter((d) => d.customer_id === customer.id),
          );
          const recorded = products.flatMap((p) => p.delivery ?? []);
          const status =
            recorded.length < products.length ? null : dayStatus(recorded.map((d) => d.status));
          return (
            <a key={customer.id} href={`/today/customer?id=${customer.id}`}>
              <Card className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-semibold">{customer.full_name}</span>
                  <Badge
                    label={status ? DELIVERY_STATUS_LABEL[status] : 'Pending'}
                    tone={status ? DELIVERY_STATUS_TONE[status] : 'neutral'}
                  />
                </div>
                <span className="text-text-secondary">{customer.address}</span>
                {products.map(({ milkTypeId, quantity, delivery }) => (
                  <span key={milkTypeId} className="text-sm text-text-secondary">
                    {data.milkTypes[milkTypeId]?.name ?? 'Product'} ·{' '}
                    {formatQuantity(quantity, data.milkTypes[milkTypeId]?.unit)}
                    {products.length > 1 && delivery
                      ? ` · ${DELIVERY_STATUS_LABEL[delivery.status]}`
                      : ''}
                    {delivery?.status === 'skipped' && delivery.reason
                      ? ` · Note: ${delivery.reason}`
                      : ''}
                  </span>
                ))}
              </Card>
            </a>
          );
        })
      )}
    </>
  );
}

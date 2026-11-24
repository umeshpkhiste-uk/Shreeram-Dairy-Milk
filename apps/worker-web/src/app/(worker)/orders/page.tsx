'use client';

import { useEffect, useState } from 'react';

import { Button, Card, EmptyState, ErrorText, LoadingState, Title } from '@/components/ui';
import { listOrdersForWorker, type WorkerOrder } from '@/lib/api/orders';
import { listCachedCustomers } from '@/lib/db/cache-repo';
import { useLive } from '@/lib/db/use-live';
import { useIsOnline } from '@/lib/sync/connectivity';

/**
 * Read-only — one-time orders (paneer, ghee, etc.) an admin assigned to this
 * worker to deliver. No fulfilment action and no pricing shown (per owner
 * decision). Online only, like the mobile screen.
 */
export default function OrdersPage() {
  const isOnline = useIsOnline();
  const customers = useLive(listCachedCustomers, []);
  const [orders, setOrders] = useState<WorkerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    listOrdersForWorker().then(
      (result) => {
        if (cancelled) return;
        setOrders(result);
        setError(null);
      },
      (err) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load orders');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isOnline, attempt]);

  const customerNames = new Map(customers?.map((c) => [c.id, c.full_name]));

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Title>Orders</Title>
        <Button variant="secondary" onClick={() => setAttempt(attempt + 1)} disabled={!isOnline}>
          Refresh
        </Button>
      </div>
      {error ? <ErrorText message={error} /> : null}
      {orders === null ? (
        !isOnline ? (
          <EmptyState title="You’re offline" description="Connect to the internet to see orders." />
        ) : error ? null : (
          <LoadingState label="Loading orders…" />
        )
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders assigned"
          description="One-time orders an admin assigns to you will appear here."
        />
      ) : (
        orders.map(({ order, items }) => (
          <Card key={order.id} className="flex flex-col gap-1">
            <span className="text-lg font-semibold">
              {(order.customer_id && customerNames.get(order.customer_id)) ||
                order.walk_in_customer_name ||
                'Unknown customer'}
            </span>
            <span className="text-text-secondary">
              {order.order_date.split('-').reverse().join('/')}
            </span>
            {items.map((item, index) => (
              <span key={index}>
                {item.productName} · {(item.quantity / 1000).toFixed(2)}{' '}
                {item.unit === 'litre' ? 'L' : 'Kg'}
              </span>
            ))}
            {order.notes ? (
              <span className="text-sm text-text-secondary">Note: {order.notes}</span>
            ) : null}
          </Card>
        ))
      )}
    </>
  );
}

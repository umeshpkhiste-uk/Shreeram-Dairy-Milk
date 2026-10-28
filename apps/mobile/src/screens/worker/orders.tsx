import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { listOrdersForWorker, type WorkerOrder } from '@/lib/api/orders';
import { getCachedCustomer } from '@/lib/sqlite/cache-repo';
import { Spacing } from '@/theme/tokens';

/**
 * Read-only — one-time orders (paneer, ghee, etc.) an admin assigned to this
 * worker to deliver. No fulfilment action here, no pricing shown (per owner
 * decision: not part of billing, worker just needs to know what to bring).
 */
export function WorkerOrdersScreen() {
  const [orders, setOrders] = useState<WorkerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setOrders(await listOrdersForWorker());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (error && orders === null) {
    return (
      <Screen>
        <ErrorState description={error} onRetry={load} />
      </Screen>
    );
  }

  if (orders === null) {
    return (
      <Screen>
        <LoadingState label="Loading orders…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">Orders</Text>
      {orders.length === 0 ? (
        <EmptyState
          title="No orders assigned"
          description="One-time orders an admin assigns to you will appear here."
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.order.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={load}
          renderItem={({ item }) => <OrderRow order={item} />}
        />
      )}
    </Screen>
  );
}

function OrderRow({ order }: { order: WorkerOrder }) {
  const customer = order.order.customer_id ? getCachedCustomer(order.order.customer_id) : null;
  const customerLabel = customer?.full_name ?? order.order.walk_in_customer_name ?? 'Unknown customer';
  return (
    <Card style={styles.row}>
      <Text variant="subtitle">{customerLabel}</Text>
      <Text variant="body" color="secondary">
        {order.order.order_date}
      </Text>
      {order.items.map((item, idx) => (
        <Text key={idx} variant="body">
          {item.productName} · {(item.quantity / 1000).toFixed(2)} {item.unit === 'litre' ? 'L' : 'Kg'}
        </Text>
      ))}
      {order.order.notes ? (
        <Text variant="caption" color="secondary">
          Note: {order.order.notes}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  row: { gap: Spacing.xs },
});

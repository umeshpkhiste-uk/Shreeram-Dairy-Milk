import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Text } from '@/components/text';
import { useAuth } from '@/lib/auth/auth-provider';
import { todayInBusinessTimezone } from '@/lib/date';
import {
  getCachedMilkTypeName,
  listCachedCustomers,
  type CachedCustomer,
} from '@/lib/sqlite/cache-repo';
import {
  listLocalDeliveriesForDate,
  recordDelivery,
  type LocalDelivery,
} from '@/lib/sqlite/deliveries-repo';
import { useIsOnline } from '@/lib/sync/connectivity';
import { pullLatestData, runSync } from '@/lib/sync/sync-engine';
import { Spacing } from '@/theme/tokens';

import { DeliveryEntrySheet, type DeliveryEntryValues } from './delivery-entry-sheet';

const STATUS_LABEL: Record<string, string> = {
  completed: 'Delivered',
  partial: 'Partial',
  missed: 'Missed',
};
const STATUS_TONE: Record<string, StatusTone> = {
  completed: 'success',
  partial: 'warning',
  missed: 'danger',
};

export function TodayRouteScreen() {
  const auth = useAuth();
  const isOnline = useIsOnline();
  const deliveryDate = useMemo(() => todayInBusinessTimezone(), []);

  const [customers, setCustomers] = useState<CachedCustomer[] | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, LocalDelivery>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CachedCustomer | null>(null);

  const loadLocal = useCallback(() => {
    setCustomers(listCachedCustomers());
    const rows = listLocalDeliveriesForDate(deliveryDate);
    setDeliveries(Object.fromEntries(rows.map((r) => [r.customer_id, r])));
  }, [deliveryDate]);

  const refreshFromServer = useCallback(async () => {
    if (auth.status !== 'signedIn' || !isOnline) {
      loadLocal();
      return;
    }
    setRefreshing(true);
    try {
      await pullLatestData(auth.session.user.id);
      setError(null);
      loadLocal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh route');
      loadLocal();
    } finally {
      setRefreshing(false);
    }
  }, [auth, isOnline, loadLocal]);

  useFocusEffect(
    useCallback(() => {
      refreshFromServer();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  function handleSave(values: DeliveryEntryValues) {
    if (!selectedCustomer) return;
    recordDelivery({
      customerId: selectedCustomer.id,
      deliveryDate,
      milkTypeId: selectedCustomer.milk_type_id,
      scheduledQuantityMl: selectedCustomer.default_daily_quantity_ml,
      deliveredQuantityMl: values.deliveredQuantityMl,
      status: values.status,
      reason: values.reason,
    });
    setSelectedCustomer(null);
    loadLocal();
    runSync();
  }

  if (auth.status !== 'signedIn') return null;

  if (error && customers === null) {
    return (
      <Screen>
        <ErrorState description={error} onRetry={refreshFromServer} />
      </Screen>
    );
  }

  if (customers === null) {
    return (
      <Screen>
        <LoadingState label="Loading today's route…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">Today&rsquo;s Route</Text>
      {customers.length === 0 ? (
        <EmptyState
          title="No customers assigned"
          description="Ask an admin to assign customers to your route."
        />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={refreshFromServer}
          renderItem={({ item }) => (
            <CustomerRow
              customer={item}
              delivery={deliveries[item.id]}
              onPress={() => setSelectedCustomer(item)}
            />
          )}
        />
      )}

      <Modal
        visible={!!selectedCustomer}
        animationType="slide"
        onRequestClose={() => setSelectedCustomer(null)}
      >
        {selectedCustomer ? (
          <DeliveryEntrySheet
            customer={selectedCustomer}
            existing={deliveries[selectedCustomer.id] ?? null}
            onCancel={() => setSelectedCustomer(null)}
            onSave={handleSave}
          />
        ) : null}
      </Modal>
    </Screen>
  );
}

function CustomerRow({
  customer,
  delivery,
  onPress,
}: {
  customer: CachedCustomer;
  delivery?: LocalDelivery;
  onPress: () => void;
}) {
  const milkTypeName = getCachedMilkTypeName(customer.milk_type_id) ?? 'Milk';
  const label = delivery ? (STATUS_LABEL[delivery.status] ?? 'Pending') : 'Pending';
  const tone: StatusTone = delivery ? (STATUS_TONE[delivery.status] ?? 'neutral') : 'neutral';

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.row}>
        <View style={styles.rowHeader}>
          <Text variant="subtitle">{customer.full_name}</Text>
          <StatusBadge label={label} tone={tone} />
        </View>
        <Text variant="body" color="secondary">
          {customer.address}
        </Text>
        <Text variant="caption" color="secondary">
          {milkTypeName} · {customer.default_daily_quantity_ml} ml
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  row: { gap: Spacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

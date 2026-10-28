import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Text } from '@/components/text';
import {
  getCachedMilkTypeName,
  listCachedCustomers,
  type CachedCustomer,
} from '@/lib/sqlite/cache-repo';
import { listLocalDeliveriesSince, type LocalDelivery } from '@/lib/sqlite/deliveries-repo';
import { Spacing } from '@/theme/tokens';

const STATUS_LABEL: Record<string, string> = {
  completed: 'Delivered',
  partial: 'Partial',
  missed: 'Missed',
  skipped: 'No delivery — customer informed',
};
const STATUS_TONE: Record<string, StatusTone> = {
  completed: 'success',
  partial: 'warning',
  missed: 'danger',
  skipped: 'warning',
};
const SYNC_LABEL: Record<string, string> = {
  pending: 'Not synced yet',
  syncing: 'Syncing…',
  synced: 'Synced',
  failed: 'Sync failed',
  conflict: 'Conflict — flagged for review',
};
const SYNC_TONE: Record<string, StatusTone> = {
  pending: 'neutral',
  syncing: 'info',
  synced: 'success',
  failed: 'danger',
  conflict: 'warning',
};

const HISTORY_DAYS = 14;

export function DeliveryHistoryScreen() {
  const [customers, setCustomers] = useState<Record<string, CachedCustomer>>({});
  const [deliveries, setDeliveries] = useState<LocalDelivery[] | null>(null);

  const load = useCallback(() => {
    setCustomers(Object.fromEntries(listCachedCustomers().map((c) => [c.id, c])));
    const since = new Date();
    since.setDate(since.getDate() - HISTORY_DAYS);
    setDeliveries(listLocalDeliveriesSince(since.toISOString().slice(0, 10)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (deliveries === null) return null;

  return (
    <Screen>
      <Text variant="title">Delivery History</Text>
      {deliveries.length === 0 ? (
        <EmptyState
          title="No deliveries recorded yet"
          description="Deliveries you record on Today's Route appear here, synced or not."
        />
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={(d) => d.delivery_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <HistoryRow delivery={item} customer={customers[item.customer_id]} />
          )}
        />
      )}
    </Screen>
  );
}

function HistoryRow({
  delivery,
  customer,
}: {
  delivery: LocalDelivery;
  customer?: CachedCustomer;
}) {
  const milkTypeName = getCachedMilkTypeName(delivery.milk_type_id) ?? 'Milk';

  return (
    <Card style={styles.row}>
      <View style={styles.rowHeader}>
        <Text variant="subtitle">{customer?.full_name ?? 'Unknown customer'}</Text>
        <StatusBadge
          label={STATUS_LABEL[delivery.status] ?? delivery.status}
          tone={STATUS_TONE[delivery.status] ?? 'neutral'}
        />
      </View>
      <Text variant="body" color="secondary">
        {delivery.delivery_date} · {milkTypeName} · {delivery.delivered_quantity_ml} ml
      </Text>
      {delivery.reason ? (
        <Text variant="caption" color="secondary">
          {delivery.reason}
        </Text>
      ) : null}
      <StatusBadge
        label={SYNC_LABEL[delivery.sync_status] ?? delivery.sync_status}
        tone={SYNC_TONE[delivery.sync_status] ?? 'neutral'}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  row: { gap: Spacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

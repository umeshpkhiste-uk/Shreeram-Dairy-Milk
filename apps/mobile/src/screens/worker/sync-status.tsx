import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Text } from '@/components/text';
import { formatDateDDMMYYYY, todayInBusinessTimezone } from '@/lib/date';
import {
  getCachedMilkTypeName,
  listCachedCustomers,
  type CachedCustomer,
} from '@/lib/sqlite/cache-repo';
import { listLocalDeliveriesForDate, type LocalDelivery } from '@/lib/sqlite/deliveries-repo';
import { listOutboxItems, retryFailedOutboxItem, type OutboxItem } from '@/lib/sqlite/outbox-repo';
import { useIsOnline } from '@/lib/sync/connectivity';
import { runSync, useSyncStatus } from '@/lib/sync/sync-engine';
import { formatMlAsLitres, summarizeTodayDeliveries } from '@/lib/sync/today-summary';
import { Spacing } from '@/theme/tokens';

const OUTBOX_STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting to sync',
  in_flight: 'Syncing…',
  done: 'Synced',
  failed: 'Failed — needs review',
};
const OUTBOX_STATUS_TONE: Record<string, StatusTone> = {
  pending: 'neutral',
  in_flight: 'info',
  done: 'success',
  failed: 'danger',
};

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  completed: 'Delivered',
  partial: 'Partial',
  missed: 'Missed',
  skipped: 'Customer informed',
};
const DELIVERY_STATUS_TONE: Record<string, StatusTone> = {
  completed: 'success',
  partial: 'warning',
  missed: 'danger',
  skipped: 'warning',
};

export function SyncStatusScreen() {
  const status = useSyncStatus();
  const isOnline = useIsOnline();
  const today = useMemo(() => todayInBusinessTimezone(), []);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [customers, setCustomers] = useState<CachedCustomer[]>([]);
  const [deliveries, setDeliveries] = useState<LocalDelivery[]>([]);

  const load = useCallback(() => {
    setItems(listOutboxItems());
    setCustomers(listCachedCustomers());
    setDeliveries(listLocalDeliveriesForDate(today));
  }, [today]);

  // Re-runs on focus, and again whenever a background sync changes these
  // counts, so rows that flipped to "synced" are reflected immediately.
  const { lastSyncedAt, pendingCount, failedCount } = status;
  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, lastSyncedAt, pendingCount, failedCount]),
  );

  const summary = useMemo(
    () => summarizeTodayDeliveries(customers, deliveries),
    [customers, deliveries],
  );
  const deliveryByCustomerId = useMemo(
    () => new Map(deliveries.map((d) => [d.customer_id, d])),
    [deliveries],
  );

  async function handleSyncNow() {
    await runSync();
    load();
  }

  function handleRetry(eventId: string) {
    retryFailedOutboxItem(eventId);
    load();
    runSync().then(load);
  }

  return (
    <Screen scroll>
      <Text variant="title">Sync Status</Text>

      <Card style={styles.card}>
        <Text variant="subtitle">Today&rsquo;s deliveries · {formatDateDDMMYYYY(today)}</Text>
        <Text variant="caption" color="secondary">
          Check these numbers before you sync.
        </Text>
        <View style={styles.statGrid}>
          <Stat label="Customers" value={summary.totalCustomers} />
          <Stat label="Delivered" value={summary.delivered} />
          <Stat label="Partial" value={summary.partial} />
          <Stat label="Missed" value={summary.missed} />
          <Stat label="Customer informed" value={summary.skipped} />
          <Stat label="Not recorded yet" value={summary.notRecorded} />
        </View>
        <Row label="Scheduled milk" value={formatMlAsLitres(summary.scheduledMl)} />
        <Row label="Delivered milk" value={formatMlAsLitres(summary.deliveredMl)} />
        {Object.entries(summary.deliveredMlByMilkType).map(([milkTypeId, ml]) => (
          <Row
            key={milkTypeId}
            label={`  ${getCachedMilkTypeName(milkTypeId) ?? 'Milk'}`}
            value={formatMlAsLitres(ml)}
          />
        ))}
        <Row label="Synced to server" value={String(summary.synced)} />
        <Row label="Waiting to sync" value={String(summary.waitingToSync)} />
      </Card>

      {customers.length > 0 ? (
        <Card style={styles.card}>
          <Text variant="subtitle">Customer-wise check</Text>
          {customers.map((customer) => {
            const delivery = deliveryByCustomerId.get(customer.id);
            return (
              <View key={customer.id} style={styles.customerRow}>
                <View style={styles.customerText}>
                  <Text variant="body">{customer.full_name}</Text>
                  <Text variant="caption" color="secondary">
                    {delivery
                      ? `${delivery.delivered_quantity_ml} of ${delivery.scheduled_quantity_ml} ml` +
                        (delivery.sync_status === 'synced' ? ' · synced' : ' · not synced yet')
                      : `${customer.default_daily_quantity_ml} ml scheduled`}
                  </Text>
                </View>
                <StatusBadge
                  label={
                    delivery
                      ? (DELIVERY_STATUS_LABEL[delivery.status] ?? delivery.status)
                      : 'Not recorded'
                  }
                  tone={delivery ? (DELIVERY_STATUS_TONE[delivery.status] ?? 'neutral') : 'neutral'}
                />
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Row label="Connection" value={isOnline ? 'Online' : 'Offline'} />
        <Row label="Pending" value={String(status.pendingCount)} />
        <Row label="Failed" value={String(status.failedCount)} />
        <Row
          label="Last synced"
          value={status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : 'Never'}
        />
        {status.lastError ? <Row label="Last error" value={status.lastError} /> : null}
        <Button
          label={status.phase === 'syncing' ? 'Syncing…' : 'Sync now'}
          onPress={handleSyncNow}
          loading={status.phase === 'syncing'}
          disabled={!isOnline}
        />
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing queued"
          description="Deliveries you record will appear here until synced."
        />
      ) : (
        items.map((item) => (
          <Card key={item.event_id} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text variant="label">
                {item.event_type === 'created' ? 'New delivery' : 'Correction'}
              </Text>
              <StatusBadge
                label={OUTBOX_STATUS_LABEL[item.status] ?? item.status}
                tone={OUTBOX_STATUS_TONE[item.status] ?? 'neutral'}
              />
            </View>
            <Text variant="caption" color="secondary">
              Attempt {item.attempt_count + 1} · recorded{' '}
              {new Date(item.created_at).toLocaleString()}
            </Text>
            {item.last_error ? (
              <Text variant="caption" color="danger">
                {item.last_error}
              </Text>
            ) : null}
            {item.status === 'failed' ? (
              <Button
                label="Retry"
                variant="secondary"
                onPress={() => handleRetry(item.event_id)}
              />
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text variant="title">{value}</Text>
      <Text variant="caption" color="secondary">
        {label}
      </Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text variant="label" color="secondary">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.sm },
  stat: { flexBasis: '33%', flexGrow: 1 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between' },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  customerText: { flex: 1 },
  row: { gap: Spacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

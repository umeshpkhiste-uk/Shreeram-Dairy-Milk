import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Text } from '@/components/text';
import { listOutboxItems, retryFailedOutboxItem, type OutboxItem } from '@/lib/sqlite/outbox-repo';
import { useIsOnline } from '@/lib/sync/connectivity';
import { runSync, useSyncStatus } from '@/lib/sync/sync-engine';
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

export function SyncStatusScreen() {
  const status = useSyncStatus();
  const isOnline = useIsOnline();
  const [items, setItems] = useState<OutboxItem[]>([]);

  const load = useCallback(() => setItems(listOutboxItems()), []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
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
    <Screen>
      <Text variant="title">Sync Status</Text>

      <Card style={styles.summary}>
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
        <FlatList
          data={items}
          keyExtractor={(i) => i.event_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.row}>
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
          )}
        />
      )}
    </Screen>
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
  summary: { gap: Spacing.sm },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between' },
  list: { gap: Spacing.sm },
  row: { gap: Spacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

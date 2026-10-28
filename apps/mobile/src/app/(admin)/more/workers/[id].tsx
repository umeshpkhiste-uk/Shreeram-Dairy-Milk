import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ChipSelect } from '@/components/chip-select';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import {
  listCustomersForWorker,
  setCustomerRouteSequence,
  type CustomerRow,
} from '@/lib/api/customers';
import { assignWorkerRoute, listRoutes, listWorkers, type WorkerSummary } from '@/lib/api/workers';
import { Spacing } from '@/theme/tokens';
import type { Database } from '@/types/database';

type RouteRow = Database['public']['Tables']['routes']['Row'];

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [worker, setWorker] = useState<WorkerSummary | null>(null);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([listWorkers(), listRoutes(), listCustomersForWorker(id)])
      .then(([workers, r, c]) => {
        const found = workers.find((w) => w.id === id) ?? null;
        setWorker(found);
        setRoutes(r);
        setCustomers(c);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load worker'));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRouteChange(newRouteId: string | null) {
    try {
      await assignWorkerRoute(id, newRouteId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign route');
    }
  }

  async function moveCustomer(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= customers.length) return;

    const a = customers[index];
    const b = customers[targetIndex];
    const aSeq = a.route_sequence ?? index + 1;
    const bSeq = b.route_sequence ?? targetIndex + 1;

    await Promise.all([setCustomerRouteSequence(a.id, bSeq), setCustomerRouteSequence(b.id, aSeq)]);
    load();
  }

  if (error) {
    return (
      <Screen>
        <ErrorState description={error} onRetry={load} />
      </Screen>
    );
  }

  if (!worker) {
    return (
      <Screen>
        <LoadingState label="Loading worker…" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="title">{worker.fullName}</Text>
      {worker.phone ? (
        <Text variant="body" color="secondary">
          {worker.phone}
        </Text>
      ) : null}

      <ChipSelect
        label="Assigned route"
        options={routes.map((r) => ({ value: r.id, label: r.name }))}
        value={worker.route?.id ?? null}
        onChange={handleRouteChange}
        allowClear
      />

      <Text variant="subtitle">Assigned customers ({customers.length})</Text>
      {customers.length === 0 ? (
        <EmptyState
          title="No customers assigned"
          description="Assign customers to this worker from the customer's edit screen."
        />
      ) : (
        <View style={styles.list}>
          {customers.map((c, index) => (
            <Card key={c.id} style={styles.row}>
              <Text variant="caption" color="secondary" style={styles.sequence}>
                {index + 1}
              </Text>
              <Text variant="body" style={styles.rowMain}>
                {c.full_name}
              </Text>
              <View style={styles.reorderButtons}>
                <Pressable
                  accessibilityLabel="Move up"
                  disabled={index === 0}
                  onPress={() => moveCustomer(index, -1)}
                  style={styles.iconButton}
                >
                  <Ionicons
                    name="chevron-up"
                    size={20}
                    color={index === 0 ? theme.tabIconDefault : theme.icon}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Move down"
                  disabled={index === customers.length - 1}
                  onPress={() => moveCustomer(index, 1)}
                  style={styles.iconButton}
                >
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={index === customers.length - 1 ? theme.tabIconDefault : theme.icon}
                  />
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sequence: { width: 20, textAlign: 'center' },
  rowMain: { flex: 1 },
  reorderButtons: { flexDirection: 'row', gap: Spacing.xs },
  iconButton: { padding: Spacing.xs },
});

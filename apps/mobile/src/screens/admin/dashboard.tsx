import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { listCustomers } from '@/lib/api/customers';
import { listDeliveriesForDate } from '@/lib/api/deliveries';
import { listWorkers } from '@/lib/api/workers';
import { computeDashboardMetrics, type DashboardMetrics } from '@/lib/dashboard/metrics';
import { todayInBusinessTimezone } from '@/lib/date';
import { formatPaiseAsRupees } from '@/lib/money';
import { subscribeToDeliveryChanges } from '@/lib/realtime/deliveries-channel';
import { Spacing } from '@/theme/tokens';

export function AdminDashboardScreen() {
  const today = useMemo(() => todayInBusinessTimezone(), []);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([listCustomers({ status: 'active' }), listWorkers(), listDeliveriesForDate(today)])
      .then(([customers, workers, deliveries]) => {
        setMetrics(computeDashboardMetrics(customers, workers, deliveries, today));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'));
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => subscribeToDeliveryChanges(load), [load]);

  if (error) {
    return (
      <Screen>
        <ErrorState description={error} onRetry={load} />
      </Screen>
    );
  }

  if (metrics === null) {
    return (
      <Screen>
        <LoadingState label="Loading dashboard…" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="title">Dashboard</Text>
      <Text variant="caption" color="secondary">
        {today}
      </Text>

      <View style={styles.grid}>
        <Tile label="Active customers" value={String(metrics.activeCustomers)} />
        <Tile label="Active workers" value={String(metrics.activeWorkers)} />
        <Tile label="Scheduled today" value={String(metrics.scheduledToday)} />
        <Tile label="Completed today" value={String(metrics.completedToday)} tone="success" />
        <Tile label="Partial today" value={String(metrics.partialToday)} tone="warning" />
        <Tile label="Missed today" value={String(metrics.missedToday)} tone="danger" />
        <Tile
          label="No record yet"
          value={String(metrics.noRecordToday)}
          hint="Not proof of a missed delivery — may be pending or completed offline, not yet synced."
        />
        <Tile label="Milk delivered today" value={`${metrics.totalMlDeliveredToday} ml`} />
        <Tile
          label="Estimated sales today"
          value={formatPaiseAsRupees(metrics.estimatedSalesPaiseToday)}
          hint="Estimate from today's recorded deliveries — authoritative billing arrives in Stage 5."
        />
      </View>

      <Text variant="subtitle">Quick actions</Text>
      <View style={styles.actions}>
        <Link href="/(admin)/customers/new" asChild>
          <Button label="Add Customer" variant="secondary" fullWidth />
        </Link>
        <Link href="/(admin)/more/workers/new" asChild>
          <Button label="Add Worker" variant="secondary" fullWidth />
        </Link>
        <Link href="/(admin)/more/workers/new-route" asChild>
          <Button label="Assign Route" variant="secondary" fullWidth />
        </Link>
        <Link href="/(admin)/deliveries" asChild>
          <Button label="View Today's Deliveries" variant="secondary" fullWidth />
        </Link>
      </View>
    </Screen>
  );
}

function Tile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'danger';
  hint?: string;
}) {
  const toneColor = tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'default';
  return (
    <Card style={styles.tile}>
      <Text variant="label" color="secondary">
        {label}
      </Text>
      <Text variant="title" color={toneColor}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" color="secondary">
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: { flexBasis: '47%', gap: Spacing.xs },
  actions: { gap: Spacing.sm },
});

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { getCachedCustomer, type CachedCustomer } from '@/lib/sqlite/cache-repo';
import { listLocalDeliveriesForCustomerInRange, type LocalDelivery } from '@/lib/sqlite/deliveries-repo';
import { Spacing } from '@/theme/tokens';

const HISTORY_DAYS = 14;

/** Numbers-only summary for one customer — counts and total quantity, no per-day rows. */
export function CustomerDeliverySummaryScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<CachedCustomer | null | undefined>(undefined);
  const [deliveries, setDeliveries] = useState<LocalDelivery[]>([]);

  const load = useCallback(() => {
    setCustomer(getCachedCustomer(customerId) ?? null);
    const since = new Date();
    since.setDate(since.getDate() - HISTORY_DAYS);
    const today = new Date().toISOString().slice(0, 10);
    setDeliveries(
      listLocalDeliveriesForCustomerInRange(customerId, since.toISOString().slice(0, 10), today),
    );
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const summary = useMemo(() => {
    const delivered = deliveries.filter((d) => d.status === 'completed' || d.status === 'partial');
    const missed = deliveries.filter((d) => d.status === 'missed');
    const skipped = deliveries.filter((d) => d.status === 'skipped');
    const totalMl = delivered.reduce((sum, d) => sum + d.delivered_quantity_ml, 0);
    return { delivered: delivered.length, missed: missed.length, skipped: skipped.length, totalMl };
  }, [deliveries]);

  if (customer === undefined) return null;

  if (customer === null) {
    return (
      <Screen>
        <EmptyState title="Customer not found" description="This customer may no longer be assigned to you." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{customer.full_name}</Text>
      <Text variant="body" color="secondary">
        {customer.address}
      </Text>

      {deliveries.length === 0 ? (
        <EmptyState
          title="No deliveries recorded yet"
          description={`No deliveries in the last ${HISTORY_DAYS} days.`}
        />
      ) : (
        <Card style={styles.summaryCard}>
          <SummaryRow label="Days delivered" value={String(summary.delivered)} />
          <SummaryRow label="Days missed" value={String(summary.missed)} />
          <SummaryRow label="Days skipped" value={String(summary.skipped)} />
          <SummaryRow label="Total quantity" value={`${(summary.totalMl / 1000).toFixed(2)} L`} />
        </Card>
      )}
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text variant="body" color="secondary">
        {label}
      </Text>
      <Text variant="subtitle">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: { gap: Spacing.sm, marginTop: Spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { listCachedCustomers, type CachedCustomer } from '@/lib/sqlite/cache-repo';
import { listLocalDeliveriesSince, type LocalDelivery } from '@/lib/sqlite/deliveries-repo';
import { Spacing } from '@/theme/tokens';

const HISTORY_DAYS = 14;

type CustomerSummary = {
  customer: CachedCustomer;
  delivered: number;
  missed: number;
  skipped: number;
};

/**
 * Customer-wise entry point for history — no per-day rows here. Tapping a
 * card opens that customer's numbers-only summary
 * (customer-delivery-summary.tsx), never a per-day breakdown.
 */
export function DeliveryHistoryScreen() {
  const [customers, setCustomers] = useState<CachedCustomer[] | null>(null);
  const [deliveries, setDeliveries] = useState<LocalDelivery[]>([]);

  const load = useCallback(() => {
    setCustomers(listCachedCustomers());
    const since = new Date();
    since.setDate(since.getDate() - HISTORY_DAYS);
    setDeliveries(listLocalDeliveriesSince(since.toISOString().slice(0, 10)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const summaries = useMemo<CustomerSummary[]>(() => {
    if (!customers) return [];
    const byCustomer = new Map<string, LocalDelivery[]>();
    for (const d of deliveries) {
      const list = byCustomer.get(d.customer_id) ?? [];
      list.push(d);
      byCustomer.set(d.customer_id, list);
    }
    return customers
      .map((customer) => {
        const rows = byCustomer.get(customer.id) ?? [];
        return {
          customer,
          delivered: rows.filter((r) => r.status === 'completed' || r.status === 'partial').length,
          missed: rows.filter((r) => r.status === 'missed').length,
          skipped: rows.filter((r) => r.status === 'skipped').length,
        };
      })
      .filter((s) => s.delivered + s.missed + s.skipped > 0);
  }, [customers, deliveries]);

  if (customers === null) return null;

  return (
    <Screen>
      <Text variant="title">Delivery History</Text>
      {summaries.length === 0 ? (
        <EmptyState
          title="No deliveries recorded yet"
          description="Deliveries you record on Today's Route appear here, grouped by customer."
        />
      ) : (
        <FlatList
          data={summaries}
          keyExtractor={(s) => s.customer.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <CustomerSummaryRow summary={item} />}
        />
      )}
    </Screen>
  );
}

function CustomerSummaryRow({ summary }: { summary: CustomerSummary }) {
  return (
    <Link href={`/(worker)/history/${summary.customer.id}`} asChild>
      <Pressable accessibilityRole="button">
        <Card style={styles.row}>
          <View style={styles.rowHeader}>
            <Text variant="subtitle">{summary.customer.full_name}</Text>
          </View>
          <Text variant="body" color="secondary">
            {summary.customer.address}
          </Text>
          <Text variant="caption" color="secondary">
            {summary.delivered} delivered · {summary.missed} missed · {summary.skipped} skipped
          </Text>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  row: { gap: Spacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge } from '@/components/status-badge';
import { Text } from '@/components/text';
import { listRecentPayments } from '@/lib/api/payments';
import type { PaymentRow } from '@/lib/api/bills';
import { formatPaiseAsRupees } from '@/lib/money';
import { Spacing } from '@/theme/tokens';

export function PaymentsLedgerScreen() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listRecentPayments()
      .then(setPayments)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load payments'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text variant="title">Payments</Text>
        <Text variant="body" color="secondary">
          Recent payments across all customers. Record a new payment from the customer&rsquo;s bill.
        </Text>
      </View>

      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : payments === null ? (
        <LoadingState label="Loading payments…" />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments recorded yet" />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Link href={`/(admin)/billing/${item.bill_id}`} asChild>
              <Pressable>
                <Card style={styles.row}>
                  <View style={styles.rowHeader}>
                    <Text variant="subtitle">{formatPaiseAsRupees(item.amount_paise)}</Text>
                    {item.voided_at ? <StatusBadge label="Voided" tone="danger" /> : null}
                  </View>
                  <Text variant="body" color="secondary">
                    {item.payment_date} · {item.method}
                    {item.transaction_reference ? ` · ${item.transaction_reference}` : ''}
                  </Text>
                </Card>
              </Pressable>
            </Link>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: Spacing.lg, gap: Spacing.xs },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  row: { gap: Spacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

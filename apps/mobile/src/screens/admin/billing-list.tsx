import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge } from '@/components/status-badge';
import { Text } from '@/components/text';
import { createDraftBill, listBillsForMonth, type MonthlyBillRow } from '@/lib/api/bills';
import { listCustomers, type CustomerRow } from '@/lib/api/customers';
import { BILL_STATUS_LABEL, BILL_STATUS_TONE } from '@/lib/billing/status';
import { firstOfMonth, shiftMonth, todayInBusinessTimezone } from '@/lib/date';
import { formatPaiseAsRupees } from '@/lib/money';
import { Spacing } from '@/theme/tokens';

export function BillingListScreen() {
  const router = useRouter();
  const [month, setMonth] = useState(() => firstOfMonth(todayInBusinessTimezone()));
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [bills, setBills] = useState<MonthlyBillRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([listCustomers({ status: 'active' }), listBillsForMonth(month)])
      .then(([c, b]) => {
        setCustomers(c);
        setBills(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load bills'));
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const billByCustomerId = useMemo(() => new Map(bills.map((b) => [b.customer_id, b])), [bills]);

  async function handleCreateBill(customerId: string) {
    setCreatingFor(customerId);
    try {
      const bill = await createDraftBill(customerId, month);
      router.push(`/(admin)/billing/${bill.id}`);
    } catch (err) {
      Alert.alert('Failed to create bill', err instanceof Error ? err.message : undefined);
    } finally {
      setCreatingFor(null);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text variant="title">Billing</Text>
        <View style={styles.monthRow}>
          <Button label="‹" variant="ghost" onPress={() => setMonth((m) => shiftMonth(m, -1))} />
          <Text variant="subtitle">
            {new Date(`${month}T00:00:00Z`).toLocaleDateString('en-IN', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </Text>
          <Button label="›" variant="ghost" onPress={() => setMonth((m) => shiftMonth(m, 1))} />
        </View>
      </View>

      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : customers === null ? (
        <LoadingState label="Loading customers…" />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const bill = billByCustomerId.get(item.id);
            return (
              <Card style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text variant="subtitle">{item.full_name}</Text>
                  {bill ? (
                    <StatusBadge
                      label={BILL_STATUS_LABEL[bill.status]}
                      tone={BILL_STATUS_TONE[bill.status]}
                    />
                  ) : (
                    <StatusBadge label="Not created" tone="neutral" />
                  )}
                </View>
                {bill ? (
                  <>
                    <Text variant="body" color="secondary">
                      {bill.bill_number} · {formatPaiseAsRupees(bill.total_payable_paise)}
                    </Text>
                    <Link href={`/(admin)/billing/${bill.id}`} asChild>
                      <Button label="View bill" variant="secondary" />
                    </Link>
                  </>
                ) : (
                  <Button
                    label="Create bill"
                    variant="secondary"
                    loading={creatingFor === item.id}
                    onPress={() => handleCreateBill(item.id)}
                  />
                )}
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: Spacing.lg, gap: Spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  row: { gap: Spacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

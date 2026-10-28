import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { listBillsForMonth, type MonthlyBillRow } from '@/lib/api/bills';
import { listCustomers, type CustomerRow } from '@/lib/api/customers';
import { listPaymentsForBillIds } from '@/lib/api/payments';
import { toCsv } from '@/lib/csv';
import { firstOfMonth, shiftMonth, todayInBusinessTimezone } from '@/lib/date';
import { shareCsv } from '@/lib/export/share-csv';
import { formatPaiseAsRupees } from '@/lib/money';
import { Spacing } from '@/theme/tokens';

type SummaryRow = {
  customerName: string;
  billNumber: string;
  billedPaise: number;
  paidPaise: number;
  outstandingPaise: number;
};

export function BillingReportScreen() {
  const [month, setMonth] = useState(() => firstOfMonth(todayInBusinessTimezone()));
  const [rows, setRows] = useState<SummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    Promise.all([listBillsForMonth(month), listCustomers({ status: 'all' })])
      .then(async ([bills, customers]) => {
        const payments = await listPaymentsForBillIds(bills.map((b) => b.id));
        const customerNameById = new Map(customers.map((c: CustomerRow) => [c.id, c.full_name]));
        const paidByBillId = new Map<string, number>();
        for (const p of payments) {
          paidByBillId.set(p.bill_id, (paidByBillId.get(p.bill_id) ?? 0) + p.amount_paise);
        }
        setRows(
          bills.map((b: MonthlyBillRow) => {
            const paid = paidByBillId.get(b.id) ?? 0;
            return {
              customerName: customerNameById.get(b.customer_id) ?? 'Unknown customer',
              billNumber: b.bill_number,
              billedPaise: b.total_payable_paise,
              paidPaise: paid,
              outstandingPaise: b.total_payable_paise - paid,
            };
          }),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'));
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totals = useMemo(() => {
    if (!rows) return null;
    return rows.reduce(
      (acc, r) => ({
        billed: acc.billed + r.billedPaise,
        paid: acc.paid + r.paidPaise,
        outstanding: acc.outstanding + r.outstandingPaise,
      }),
      { billed: 0, paid: 0, outstanding: 0 },
    );
  }, [rows]);

  async function handleExport() {
    if (!rows) return;
    setExporting(true);
    try {
      const csv = toCsv(
        ['Customer', 'Bill Number', 'Billed (₹)', 'Paid (₹)', 'Outstanding (₹)'],
        rows.map((r) => [
          r.customerName,
          r.billNumber,
          (r.billedPaise / 100).toFixed(2),
          (r.paidPaise / 100).toFixed(2),
          (r.outstandingPaise / 100).toFixed(2),
        ]),
      );
      await shareCsv(`billing-summary-${month}.csv`, csv);
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text variant="title">Reports</Text>
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
        {totals ? (
          <Card style={styles.totalsCard}>
            <Text variant="body" color="secondary">
              Billed {formatPaiseAsRupees(totals.billed)} · Paid {formatPaiseAsRupees(totals.paid)}{' '}
              · Outstanding {formatPaiseAsRupees(totals.outstanding)}
            </Text>
          </Card>
        ) : null}
        <Button
          label="Export CSV"
          variant="secondary"
          loading={exporting}
          disabled={!rows || rows.length === 0}
          onPress={handleExport}
        />
      </View>

      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : rows === null ? (
        <LoadingState label="Loading report…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No bills for this month yet" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.billNumber}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.row}>
              <Text variant="subtitle">{item.customerName}</Text>
              <Text variant="body" color="secondary">
                {item.billNumber} · Billed {formatPaiseAsRupees(item.billedPaise)} · Outstanding{' '}
                {formatPaiseAsRupees(item.outstandingPaise)}
              </Text>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: Spacing.lg, gap: Spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  totalsCard: { gap: 0 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  row: { gap: Spacing.xs },
});

import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Input } from '@/components/input';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { createDraftBill, listBillsForCustomer, type MonthlyBillRow } from '@/lib/api/bills';
import { getCustomer, type CustomerRow } from '@/lib/api/customers';
import {
  listDeliveriesForCustomerInRange,
  markDeliverySkipped,
  type DeliveryRow,
} from '@/lib/api/deliveries';
import { BILL_STATUS_LABEL, BILL_STATUS_TONE } from '@/lib/billing/status';
import {
  firstOfMonth,
  lastOfMonth,
  shiftDate,
  shiftMonth,
  todayInBusinessTimezone,
} from '@/lib/date';
import { formatPaiseAsRupees } from '@/lib/money';
import { Radius, Spacing } from '@/theme/tokens';
import type { DeliveryStatus } from '@/types/database';

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  completed: 'Delivered',
  partial: 'Partial',
  missed: 'Missed',
  skipped: 'Customer informed — no delivery',
};
const STATUS_TONE: Record<DeliveryStatus, StatusTone> = {
  completed: 'success',
  partial: 'success',
  missed: 'danger',
  skipped: 'warning',
};
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthLabel(monthFirstDate: string): string {
  return new Date(`${monthFirstDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Weeks of date strings for the given month, padded with null for alignment. */
function buildMonthGrid(monthFirstDate: string): (string | null)[][] {
  const daysInMonth = new Date(`${lastOfMonth(monthFirstDate)}T00:00:00Z`).getUTCDate();
  const firstWeekday = new Date(`${monthFirstDate}T00:00:00Z`).getUTCDay();

  const cells: (string | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => shiftDate(monthFirstDate, i)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Admin's per-customer delivery calendar — mirrors
 * apps/web/src/app/(admin)/deliveries/[customerId]/page.tsx exactly:
 * any day (not just today) can be marked "customer informed — no delivery",
 * plus a monthly summary and that month's bill (view existing or create a
 * draft). This is a different screen from the worker's own
 * customer-delivery-calendar.tsx, which only lets a worker mark *today*.
 */
export function AdminCustomerDeliveryCalendarScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const today = useMemo(() => todayInBusinessTimezone(), []);

  const [month, setMonth] = useState(() => firstOfMonth(today));
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [entries, setEntries] = useState<Record<string, DeliveryRow>>({});
  const [bills, setBills] = useState<MonthlyBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [creatingBill, setCreatingBill] = useState(false);

  const load = useCallback(
    async (targetMonth: string) => {
      setLoading(true);
      setError(null);
      try {
        const [customerRow, deliveryRows, billRows] = await Promise.all([
          getCustomer(customerId),
          listDeliveriesForCustomerInRange(customerId, targetMonth, lastOfMonth(targetMonth)),
          listBillsForCustomer(customerId),
        ]);
        setCustomer(customerRow);
        setEntries(Object.fromEntries(deliveryRows.map((d) => [d.delivery_date, d])));
        setBills(billRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load delivery calendar');
      } finally {
        setLoading(false);
      }
    },
    [customerId],
  );

  useFocusEffect(
    useCallback(() => {
      load(month);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId]),
  );

  function goToMonth(newMonth: string) {
    setMonth(newMonth);
    setSelectedDate(null);
    load(newMonth);
  }

  const selectedEntry = selectedDate ? entries[selectedDate] : undefined;
  const canMarkSkipped =
    !!selectedDate && selectedEntry?.status !== 'completed' && selectedEntry?.status !== 'partial';

  async function handleMarkSkipped() {
    if (!selectedDate) return;
    setSaving(true);
    try {
      await markDeliverySkipped(
        customerId,
        selectedDate,
        reason.trim() || 'Customer informed — no delivery',
      );
      setReason('');
      await load(month);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark this day');
    } finally {
      setSaving(false);
    }
  }

  const bill = useMemo(
    () =>
      bills.find((b) => b.billing_month === month && b.status !== 'voided') ??
      bills.find((b) => b.billing_month === month) ??
      null,
    [bills, month],
  );

  async function handleCreateBill() {
    setCreatingBill(true);
    try {
      const created = await createDraftBill(customerId, month);
      router.push(`/(admin)/billing/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the bill');
    } finally {
      setCreatingBill(false);
    }
  }

  // Only count days through today for the current month, the whole month
  // for a past month, and nothing for a month that hasn't started yet —
  // same rule as the web admin page.
  const countedThrough =
    month <= firstOfMonth(today)
      ? month === firstOfMonth(today)
        ? today
        : lastOfMonth(month)
      : null;
  const summary = useMemo(() => {
    const s = { delivered: 0, missed: 0, skipped: 0, noRecord: 0, totalMl: 0 };
    if (!countedThrough) return s;
    for (let d = month; d <= countedThrough; d = shiftDate(d, 1)) {
      const entry = entries[d];
      if (!entry) {
        s.noRecord += 1;
      } else if (entry.status === 'completed' || entry.status === 'partial') {
        s.delivered += 1;
        s.totalMl += entry.delivered_quantity_ml;
      } else if (entry.status === 'missed') {
        s.missed += 1;
      } else if (entry.status === 'skipped') {
        s.skipped += 1;
      }
    }
    return s;
  }, [entries, month, countedThrough]);

  if (loading && customer === null) {
    return (
      <Screen>
        <LoadingState label="Loading delivery calendar…" />
      </Screen>
    );
  }

  if (error && customer === null) {
    return (
      <Screen>
        <ErrorState description={error} onRetry={() => load(month)} />
      </Screen>
    );
  }

  if (!customer) {
    return (
      <Screen>
        <ErrorState
          title="Customer not found"
          description="Go back and pick a customer from the list."
        />
      </Screen>
    );
  }

  const grid = buildMonthGrid(month);
  const label = monthLabel(month);

  return (
    <Screen scroll>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text variant="title">{customer.full_name}</Text>
          <Text variant="body" color="secondary">
            {customer.address} · {customer.mobile_number}
          </Text>
        </View>
        <Link href="/(admin)/deliveries" asChild>
          <Button label="Back to Deliveries" variant="secondary" />
        </Link>
      </View>

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.monthHeader}>
          <Button label="‹" variant="secondary" onPress={() => goToMonth(shiftMonth(month, -1))} />
          <Text variant="subtitle">{label}</Text>
          <Button label="›" variant="secondary" onPress={() => goToMonth(shiftMonth(month, 1))} />
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((w) => (
            <Text key={w} variant="caption" color="secondary" style={styles.weekdayCell}>
              {w}
            </Text>
          ))}
        </View>

        {grid.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((date, dayIndex) => (
              <DayCell
                key={date ?? `blank-${dayIndex}`}
                date={date}
                today={today}
                entry={date ? entries[date] : undefined}
                selected={!!date && date === selectedDate}
                onPress={date ? () => setSelectedDate(date) : undefined}
              />
            ))}
          </View>
        ))}

        <View style={styles.legend}>
          <LegendDot color={theme.successBg} label="Delivered" />
          <LegendDot color={theme.dangerBg} label="Missed" />
          <LegendDot color={theme.warningBg} label="Customer informed" />
          <LegendDot color={theme.surface} border label="No record" />
        </View>
      </Card>

      {selectedDate ? (
        <Card style={styles.card}>
          <View style={styles.detailHeader}>
            <Text variant="label">
              {new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </Text>
            {selectedEntry ? (
              <StatusBadge
                label={STATUS_LABEL[selectedEntry.status]}
                tone={STATUS_TONE[selectedEntry.status]}
              />
            ) : (
              <StatusBadge label="No record" tone="neutral" />
            )}
          </View>

          {selectedEntry?.reason ? (
            <Text variant="caption" color="secondary">
              Note: {selectedEntry.reason}
            </Text>
          ) : null}

          {canMarkSkipped ? (
            <View style={styles.skipForm}>
              <Input
                label='Reason (shown to the business, e.g. "Customer on vacation till 5th")'
                value={reason}
                onChangeText={setReason}
                placeholder="Customer informed — no delivery"
              />
              <Button
                label='Mark "customer informed — no delivery"'
                onPress={handleMarkSkipped}
                loading={saving}
              />
            </View>
          ) : (
            <Text variant="body" color="secondary">
              This day already has a recorded delivery — it can&rsquo;t be marked skipped here.
            </Text>
          )}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text variant="subtitle">
          {label} summary{countedThrough ? '' : ' (upcoming month)'}
        </Text>
        {countedThrough ? (
          <>
            <View style={styles.statGrid}>
              <Stat label="Delivered" value={summary.delivered} />
              <Stat label="Missed" value={summary.missed} />
              <Stat label="Customer informed" value={summary.skipped} />
              <Stat label="No record" value={summary.noRecord} />
            </View>
            <Text variant="body" color="secondary">
              Total delivered: {(summary.totalMl / 1000).toFixed(2)} L across {summary.delivered}{' '}
              day
              {summary.delivered === 1 ? '' : 's'}.
            </Text>
          </>
        ) : (
          <Text variant="body" color="secondary">
            This month hasn&rsquo;t started yet.
          </Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">Bill for {label}</Text>
        {bill ? (
          <View style={styles.billRow}>
            <View style={styles.billInfo}>
              <StatusBadge
                label={BILL_STATUS_LABEL[bill.status]}
                tone={BILL_STATUS_TONE[bill.status]}
              />
              <Text variant="body" color="secondary">
                {bill.bill_number} · Total payable {formatPaiseAsRupees(bill.total_payable_paise)}
              </Text>
            </View>
            <Link href={`/(admin)/billing/${bill.id}`} asChild>
              <Button label="View & share bill (PDF) →" />
            </Link>
          </View>
        ) : (
          <>
            <EmptyState
              title="No bill created for this month yet"
              description="Create a draft bill to see totals and share a PDF with the customer."
            />
            <Button
              label={`Create draft bill for ${label}`}
              onPress={handleCreateBill}
              loading={creatingBill}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}

function DayCell({
  date,
  today,
  entry,
  selected,
  onPress,
}: {
  date: string | null;
  today: string;
  entry?: DeliveryRow;
  selected: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();

  if (!date) return <View style={styles.dayCell} />;

  const isFuture = date > today;
  const isToday = date === today;

  let bg = 'transparent';
  if (entry?.status === 'completed' || entry?.status === 'partial') bg = theme.successBg;
  else if (entry?.status === 'missed') bg = theme.dangerBg;
  else if (entry?.status === 'skipped') bg = theme.warningBg;

  const dayNumber = Number(date.slice(8, 10));

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.dayCell,
        styles.dayCellPressable,
        { backgroundColor: bg, opacity: isFuture ? 0.4 : 1 },
        selected ? { borderColor: theme.primary, borderWidth: 2 } : null,
        isToday && !selected ? { borderColor: theme.primary, borderWidth: 1 } : null,
      ]}
    >
      <Text variant="caption">{dayNumber}</Text>
    </Pressable>
  );
}

function LegendDot({ color, border, label }: { color: string; border?: boolean; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: color },
          border ? { borderWidth: 1, borderColor: theme.border } : null,
        ]}
      />
      <Text variant="caption" color="secondary">
        {label}
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surfaceMuted }]}>
      <Text variant="title">{value}</Text>
      <Text variant="caption" color="secondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  titleBlock: { flex: 1, gap: Spacing.xs },
  card: { gap: Spacing.sm, marginTop: Spacing.md },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekdayRow: { flexDirection: 'row', marginTop: Spacing.sm },
  weekdayCell: { flex: 1, textAlign: 'center' },
  weekRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  dayCellPressable: { borderWidth: 1, borderColor: 'transparent' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skipForm: { gap: Spacing.sm },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: { flexBasis: '47%', flexGrow: 1, borderRadius: Radius.md, padding: Spacing.sm, gap: 2 },
  billRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  billInfo: { gap: Spacing.xs },
});

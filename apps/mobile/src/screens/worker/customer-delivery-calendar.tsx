import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { listDeliveriesForCustomerInRange } from '@/lib/api/deliveries';
import { firstOfMonth, lastOfMonth, shiftDate, shiftMonth, todayInBusinessTimezone } from '@/lib/date';
import { getCachedCustomer, type CachedCustomer } from '@/lib/sqlite/cache-repo';
import {
  applyServerDelivery,
  listLocalDeliveriesForCustomerInRange,
  recordDelivery,
  type LocalDelivery,
} from '@/lib/sqlite/deliveries-repo';
import { useIsOnline } from '@/lib/sync/connectivity';
import { runSync } from '@/lib/sync/sync-engine';
import { Radius, Spacing } from '@/theme/tokens';

const STATUS_LABEL: Record<string, string> = {
  completed: 'Delivered',
  partial: 'Partial',
  missed: 'Missed',
  skipped: 'No delivery — customer informed',
};
const STATUS_TONE: Record<string, StatusTone> = {
  completed: 'success',
  partial: 'warning',
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
  const daysInMonth = new Date(
    `${lastOfMonth(monthFirstDate)}T00:00:00Z`,
  ).getUTCDate();
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

export function CustomerDeliveryCalendarScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const theme = useTheme();
  const isOnline = useIsOnline();
  const today = useMemo(() => todayInBusinessTimezone(), []);

  const [month, setMonth] = useState(() => firstOfMonth(today));
  const [customer, setCustomer] = useState<CachedCustomer | null>(null);
  const [entries, setEntries] = useState<Record<string, LocalDelivery>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadLocal = useCallback(
    (targetMonth: string) => {
      setCustomer(getCachedCustomer(customerId));
      const rows = listLocalDeliveriesForCustomerInRange(
        customerId,
        targetMonth,
        lastOfMonth(targetMonth),
      );
      setEntries(Object.fromEntries(rows.map((r) => [r.delivery_date, r])));
    },
    [customerId],
  );

  const refresh = useCallback(
    async (targetMonth: string) => {
      setLoading(true);
      setError(null);
      loadLocal(targetMonth);
      if (isOnline) {
        try {
          const serverRows = await listDeliveriesForCustomerInRange(
            customerId,
            targetMonth,
            lastOfMonth(targetMonth),
          );
          for (const d of serverRows) {
            applyServerDelivery({
              delivery_id: d.id,
              customer_id: d.customer_id,
              delivery_date: d.delivery_date,
              milk_type_id: d.milk_type_id,
              scheduled_quantity_ml: d.scheduled_quantity_ml,
              delivered_quantity_ml: d.delivered_quantity_ml,
              status: d.status,
              reason: d.reason,
              device_recorded_at: d.device_recorded_at,
              version: d.version,
              has_conflict: d.has_conflict,
            });
          }
          loadLocal(targetMonth);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load delivery history');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    },
    [customerId, isOnline, loadLocal],
  );

  useFocusEffect(
    useCallback(() => {
      refresh(month);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId]),
  );

  function goToMonth(newMonth: string) {
    setMonth(newMonth);
    refresh(newMonth);
  }

  const selectedEntry = selectedDate ? entries[selectedDate] : undefined;
  const selectedIsToday = selectedDate === today;
  const selectedIsLocked = selectedIsToday && selectedEntry?.status === 'completed';
  const canMarkSelected = selectedIsToday && selectedEntry?.status !== 'completed';

  function handleSelectDate(date: string) {
    if (date > today) return;
    setSelectedDate(date);
  }

  function handleMark(status: 'completed' | 'missed') {
    if (!customer || !selectedDate) return;
    setSaving(true);
    recordDelivery({
      customerId: customer.id,
      deliveryDate: selectedDate,
      milkTypeId: customer.milk_type_id,
      scheduledQuantityMl: customer.default_daily_quantity_ml,
      deliveredQuantityMl: status === 'completed' ? customer.default_daily_quantity_ml : 0,
      status,
      reason: null,
    });
    loadLocal(month);
    setConfirmVisible(false);
    setSaving(false);
    runSync();
  }

  if (loading && customer === null) {
    return (
      <Screen>
        <LoadingState label="Loading delivery history…" />
      </Screen>
    );
  }

  if (!customer) {
    return (
      <Screen>
        <ErrorState title="Customer not found" description="Go back and pick a customer from the list." />
      </Screen>
    );
  }

  const grid = buildMonthGrid(month);

  return (
    <Screen scroll>
      <Text variant="title">{customer.full_name}</Text>
      <Text variant="body" color="secondary">
        {customer.address}
      </Text>

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <View style={styles.monthHeader}>
        <Button label="‹" variant="secondary" onPress={() => goToMonth(shiftMonth(month, -1))} />
        <Text variant="subtitle">{monthLabel(month)}</Text>
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
              onPress={date ? () => handleSelectDate(date) : undefined}
            />
          ))}
        </View>
      ))}

      {selectedDate ? (
        <Card style={styles.detailCard}>
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
                label={STATUS_LABEL[selectedEntry.status] ?? selectedEntry.status}
                tone={STATUS_TONE[selectedEntry.status] ?? 'neutral'}
              />
            ) : (
              <StatusBadge label={selectedIsToday ? 'Not marked yet' : 'No record'} tone="neutral" />
            )}
          </View>

          {selectedEntry?.reason ? (
            <Text variant="caption" color="secondary">
              Note: {selectedEntry.reason}
            </Text>
          ) : null}

          {selectedIsLocked ? (
            <Text variant="caption" color="secondary">
              Delivery already confirmed for today — this can no longer be changed here.
            </Text>
          ) : null}

          {canMarkSelected ? (
            <Button label="Mark today's delivery" onPress={() => setConfirmVisible(true)} />
          ) : null}

          {!selectedIsToday && !selectedEntry ? (
            <Text variant="caption" color="secondary">
              Only today&rsquo;s delivery can be marked here.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Modal
        visible={confirmVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text variant="subtitle">Milk delivered today?</Text>
            <Text variant="body" color="secondary">
              {customer.full_name} · {customer.default_daily_quantity_ml} ml
            </Text>
            <View style={styles.modalActions}>
              <Button
                label="Yes, delivered"
                onPress={() => handleMark('completed')}
                loading={saving}
              />
              <Button
                label="No, not delivered"
                variant="secondary"
                onPress={() => handleMark('missed')}
                loading={saving}
              />
              <Button label="Cancel" variant="ghost" onPress={() => setConfirmVisible(false)} />
            </View>
          </Card>
        </View>
      </Modal>
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
  entry?: LocalDelivery;
  selected: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();

  if (!date) return <View style={styles.dayCell} />;

  const isFuture = date > today;
  const isToday = date === today;

  let bg = 'transparent';
  if (entry?.status === 'completed') bg = theme.successBg;
  else if (entry?.status === 'missed') bg = theme.dangerBg;
  else if (entry?.status === 'partial' || entry?.status === 'skipped') bg = theme.warningBg;
  else if (isToday) bg = theme.primaryMuted;

  const dayNumber = Number(date.slice(8, 10));

  return (
    <Pressable
      onPress={onPress}
      disabled={isFuture || !onPress}
      style={[
        styles.dayCell,
        styles.dayCellPressable,
        { backgroundColor: bg, opacity: isFuture ? 0.35 : 1 },
        selected ? { borderColor: theme.primary, borderWidth: 2 } : null,
        isToday && !selected ? { borderColor: theme.primary, borderWidth: 1 } : null,
      ]}
    >
      <Text variant="caption">{dayNumber}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
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
  detailCard: { marginTop: Spacing.lg, gap: Spacing.sm },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: { width: '100%', gap: Spacing.md },
  modalActions: { gap: Spacing.sm },
});

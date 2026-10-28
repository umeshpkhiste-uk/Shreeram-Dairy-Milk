import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChipSelect } from '@/components/chip-select';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Input } from '@/components/input';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge, type StatusTone } from '@/components/status-badge';
import { Text } from '@/components/text';
import { listDailyDeliveryReport } from '@/lib/api/deliveries';
import { listActiveMilkTypes } from '@/lib/api/milk-types';
import { listRoutes, listWorkers, type WorkerSummary } from '@/lib/api/workers';
import { shiftDate, todayInBusinessTimezone } from '@/lib/date';
import type { DeliveryReportRow, DeliveryReportStatusFilter } from '@/lib/dashboard/metrics';
import { subscribeToDeliveryChanges } from '@/lib/realtime/deliveries-channel';
import { Spacing } from '@/theme/tokens';
import type { Database } from '@/types/database';

type RouteRow = Database['public']['Tables']['routes']['Row'];
type StatusOptionValue = NonNullable<DeliveryReportStatusFilter>;

const STATUS_OPTIONS: { value: StatusOptionValue; label: string }[] = [
  { value: 'completed', label: 'Delivered' },
  { value: 'partial', label: 'Partial' },
  { value: 'missed', label: 'Missed' },
  { value: 'no_record', label: 'No record yet' },
];

const STATUS_LABEL: Record<string, string> = {
  completed: 'Delivered',
  partial: 'Partial',
  missed: 'Missed',
  skipped: 'Customer informed',
};
const STATUS_TONE: Record<string, StatusTone> = {
  completed: 'success',
  partial: 'warning',
  missed: 'danger',
  skipped: 'warning',
};

export function DailyDeliveryReportScreen() {
  const [date, setDate] = useState(() => todayInBusinessTimezone());
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [status, setStatus] = useState<DeliveryReportStatusFilter>(null);
  const [search, setSearch] = useState('');

  const [rows, setRows] = useState<DeliveryReportRow[] | null>(null);
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [milkTypeNames, setMilkTypeNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      listDailyDeliveryReport({
        date,
        workerId: workerId ?? undefined,
        routeId: routeId ?? undefined,
        customerSearch: search,
        status,
      }),
      listWorkers(),
      listRoutes(),
      listActiveMilkTypes(),
    ])
      .then(([report, workerList, routeList, milkTypes]) => {
        setRows(report);
        setWorkers(workerList);
        setRoutes(routeList);
        setMilkTypeNames(Object.fromEntries(milkTypes.map((m) => [m.id, m.name])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'));
  }, [date, workerId, routeId, search, status]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => subscribeToDeliveryChanges(load), [load]);

  const workerOptions = useMemo(
    () => workers.map((w) => ({ value: w.id, label: w.fullName })),
    [workers],
  );
  const routeOptions = useMemo(() => routes.map((r) => ({ value: r.id, label: r.name })), [routes]);
  const workerNameById = useMemo(() => new Map(workers.map((w) => [w.id, w.fullName])), [workers]);
  const routeNameById = useMemo(() => new Map(routes.map((r) => [r.id, r.name])), [routes]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text variant="title">Daily Deliveries</Text>

        <View style={styles.dateRow}>
          <Button label="‹ Prev" variant="ghost" onPress={() => setDate((d) => shiftDate(d, -1))} />
          <Input
            value={date}
            onChangeText={setDate}
            style={styles.dateInput}
            autoCapitalize="none"
          />
          <Button label="Next ›" variant="ghost" onPress={() => setDate((d) => shiftDate(d, 1))} />
        </View>

        <Input
          placeholder="Search customer by name or mobile number"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />

        {workerOptions.length > 0 ? (
          <ChipSelect
            label="Worker"
            options={workerOptions}
            value={workerId}
            onChange={setWorkerId}
            allowClear
          />
        ) : null}
        {routeOptions.length > 0 ? (
          <ChipSelect
            label="Route"
            options={routeOptions}
            value={routeId}
            onChange={setRouteId}
            allowClear
          />
        ) : null}
        <ChipSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(value) => setStatus(value)}
          allowClear
          scroll={false}
        />
      </View>

      <ReportBody
        rows={rows}
        error={error}
        onRetry={load}
        workerNameById={workerNameById}
        routeNameById={routeNameById}
        milkTypeNames={milkTypeNames}
      />
    </Screen>
  );
}

function ReportBody({
  rows,
  error,
  onRetry,
  workerNameById,
  routeNameById,
  milkTypeNames,
}: {
  rows: DeliveryReportRow[] | null;
  error: string | null;
  onRetry: () => void;
  workerNameById: Map<string, string>;
  routeNameById: Map<string, string>;
  milkTypeNames: Record<string, string>;
}) {
  if (error) {
    return <ErrorState description={error} onRetry={onRetry} />;
  }

  if (rows === null) {
    return <LoadingState label="Loading deliveries…" />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No customers match these filters"
        description="Adjust the date, worker, route, status, or search filters."
      />
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.customer.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <ReportRow
          row={item}
          workerName={
            item.customer.assigned_worker_id
              ? (workerNameById.get(item.customer.assigned_worker_id) ?? 'Unassigned')
              : 'Unassigned'
          }
          routeName={
            item.customer.route_id ? (routeNameById.get(item.customer.route_id) ?? '—') : '—'
          }
          milkTypeNames={milkTypeNames}
        />
      )}
    />
  );
}

function ReportRow({
  row,
  workerName,
  routeName,
  milkTypeNames,
}: {
  row: DeliveryReportRow;
  workerName: string;
  routeName: string;
  milkTypeNames: Record<string, string>;
}) {
  const { customer, delivery } = row;
  const milkTypeName = milkTypeNames[delivery?.milk_type_id ?? customer.milk_type_id] ?? 'Milk';
  const expectedMl = delivery?.scheduled_quantity_ml ?? customer.default_daily_quantity_ml;

  return (
    <Card style={styles.row}>
      <View style={styles.rowHeader}>
        <Text variant="subtitle">{customer.full_name}</Text>
        {delivery ? (
          <StatusBadge
            label={STATUS_LABEL[delivery.status] ?? delivery.status}
            tone={STATUS_TONE[delivery.status] ?? 'neutral'}
          />
        ) : (
          <StatusBadge label="No record yet" tone="neutral" />
        )}
      </View>
      <Text variant="body" color="secondary">
        {workerName} · {routeName} · {milkTypeName}
      </Text>
      <Text variant="body" color="secondary">
        Expected {expectedMl} ml
        {delivery ? ` · Delivered ${delivery.delivered_quantity_ml} ml` : ''}
      </Text>
      {delivery ? (
        <Text variant="caption" color="secondary">
          Recorded {new Date(delivery.device_recorded_at).toLocaleString()} · Received by server
        </Text>
      ) : (
        <Text variant="caption" color="secondary">
          Not yet received by the server — may be genuinely pending or completed offline and not yet
          synced.
        </Text>
      )}
      {delivery?.reason ? (
        <Text variant="caption" color="secondary">
          Reason: {delivery.reason}
        </Text>
      ) : null}
      {delivery?.has_conflict ? <StatusBadge label="Flagged for review" tone="warning" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { padding: Spacing.lg, gap: Spacing.md },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dateInput: { flex: 1 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  row: { gap: Spacing.xs },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

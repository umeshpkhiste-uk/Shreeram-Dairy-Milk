'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  firstOfMonth,
  formatBillingMonth,
  lastOfMonth,
  shiftMonth,
  todayInBusinessTimezone,
} from '@shreeram/shared';

import {
  Badge,
  Button,
  Card,
  DELIVERY_STATUS_LABEL,
  DELIVERY_STATUS_TONE,
  EmptyState,
  ErrorText,
  LoadingState,
  Title,
  TONE_CLASSES,
} from '@/components/ui';
import { listDeliveriesForCustomerInRange } from '@/lib/api/deliveries';
import { getCachedCustomer } from '@/lib/db/cache-repo';
import type { LocalDelivery } from '@/lib/db/db';
import { listLocalDeliveriesForCustomerInRange, recordDelivery } from '@/lib/db/deliveries-repo';
import { useLive } from '@/lib/db/use-live';
import { buildMonthGrid } from '@/lib/month-grid';
import { useIsOnline } from '@/lib/sync/connectivity';
import { applyServerRows, runSync } from '@/lib/sync/sync-engine';
import { useToday } from '@/lib/use-today';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CustomerDeliveryCalendar() {
  const customerId = useSearchParams().get('id') ?? '';
  const today = useToday();

  if (!today) return <LoadingState label="Loading delivery history…" />;
  // Keyed so a new day starts from a clean selection.
  return <Calendar key={today} customerId={customerId} today={today} />;
}

function Calendar({ customerId, today }: { customerId: string; today: string }) {
  const isOnline = useIsOnline();
  const [month, setMonth] = useState(() => firstOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const customer = useLive(() => getCachedCustomer(customerId), [customerId]);
  const entries = useLive(
    async () =>
      new Map(
        (
          await listLocalDeliveriesForCustomerInRange(customerId, month, lastOfMonth(month))
        ).map((d) => [d.delivery_date, d]),
      ),
    [customerId, month],
  );

  // Local rows show immediately; the server's version of the month lands when it lands.
  useEffect(() => {
    if (!isOnline || !customerId) return;
    let cancelled = false;
    listDeliveriesForCustomerInRange(customerId, month, lastOfMonth(month))
      .then(applyServerRows)
      .then(
        () => {
          if (!cancelled) setError(null);
        },
        (err) => {
          if (!cancelled) setError(err?.message ?? 'Failed to load delivery history');
        },
      );
    return () => {
      cancelled = true;
    };
  }, [customerId, month, isOnline]);

  if (customer === undefined || entries === undefined) {
    return <LoadingState label="Loading delivery history…" />;
  }
  if (customer === null) {
    return (
      <EmptyState
        title="Customer not found"
        description="Go back and pick a customer from the list."
      />
    );
  }

  const selectedEntry = selectedDate ? entries.get(selectedDate) : undefined;
  const selectedIsToday = selectedDate === today;

  async function handleMark(status: 'completed' | 'missed') {
    if (!customer) return;
    if (todayInBusinessTimezone() !== today) {
      dialogRef.current?.close();
      setError('The date has changed. Reopen this customer to mark today’s delivery.');
      return;
    }
    if (entries?.get(today)?.status === status) {
      dialogRef.current?.close();
      return;
    }
    setSaving(true);
    try {
      await recordDelivery({
        customerId: customer.id,
        deliveryDate: today,
        milkTypeId: customer.milk_type_id,
        scheduledQuantityMl: customer.default_daily_quantity_ml,
        deliveredQuantityMl: status === 'completed' ? customer.default_daily_quantity_ml : 0,
        status,
        // The server requires a reason for anything but a completed delivery.
        reason: status === 'missed' ? 'Marked not delivered by worker' : null,
      });
      setError(null);
      runSync();
    } catch (err) {
      setError(`Not saved: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
      dialogRef.current?.close();
    }
  }

  return (
    <>
      <a href="/today" className="flex min-h-12 w-fit items-center text-primary">
        ‹ Today&rsquo;s Route
      </a>
      <Title>{customer.full_name}</Title>
      <p className="text-text-secondary">{customer.address}</p>
      {error ? <ErrorText message={error} /> : null}

      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          ‹
        </Button>
        <span className="text-lg font-semibold">{formatBillingMonth(month)}</span>
        <Button
          variant="secondary"
          aria-label="Next month"
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          ›
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-secondary">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {buildMonthGrid(month)
          .flat()
          .map((date, index) =>
            date ? (
              <DayCell
                key={date}
                date={date}
                today={today}
                entry={entries.get(date)}
                selected={date === selectedDate}
                onSelect={() => setSelectedDate(date)}
              />
            ) : (
              <span key={`blank-${index}`} />
            ),
          )}
      </div>

      {selectedDate ? (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </span>
            {selectedEntry ? (
              <Badge
                label={DELIVERY_STATUS_LABEL[selectedEntry.status]}
                tone={DELIVERY_STATUS_TONE[selectedEntry.status]}
              />
            ) : (
              <Badge label={selectedIsToday ? 'Not marked yet' : 'No record'} />
            )}
          </div>
          {selectedEntry?.reason ? (
            <p className="text-sm text-text-secondary">Note: {selectedEntry.reason}</p>
          ) : null}
          {selectedIsToday && selectedEntry?.status === 'completed' ? (
            <p className="text-sm text-text-secondary">
              Delivery already confirmed for today — this can no longer be changed here.
            </p>
          ) : null}
          {selectedIsToday && selectedEntry?.status !== 'completed' ? (
            <Button onClick={() => dialogRef.current?.showModal()}>
              Mark today&rsquo;s delivery
            </Button>
          ) : null}
          {!selectedIsToday && !selectedEntry ? (
            <p className="text-sm text-text-secondary">
              Only today&rsquo;s delivery can be marked here.
            </p>
          ) : null}
        </Card>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby="mark-title"
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg p-5 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3">
          <h2 id="mark-title" className="text-lg font-semibold">
            Milk delivered today?
          </h2>
          <p className="text-text-secondary">
            {customer.full_name} · {customer.default_daily_quantity_ml} ml
          </p>
          <Button onClick={() => handleMark('completed')} disabled={saving}>
            Yes, delivered
          </Button>
          <Button variant="danger" onClick={() => handleMark('missed')} disabled={saving}>
            No, not delivered
          </Button>
          <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
            Cancel
          </Button>
        </div>
      </dialog>
    </>
  );
}

function DayCell({
  date,
  today,
  entry,
  selected,
  onSelect,
}: {
  date: string;
  today: string;
  entry?: LocalDelivery;
  selected: boolean;
  onSelect: () => void;
}) {
  const isToday = date === today;
  const background = entry
    ? TONE_CLASSES[DELIVERY_STATUS_TONE[entry.status]]
    : isToday
      ? 'bg-primary-muted'
      : '';
  const border = selected
    ? 'border-2 border-primary'
    : isToday
      ? 'border border-primary'
      : 'border border-transparent';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={date > today}
      aria-pressed={selected}
      aria-label={`${date}${entry ? `, ${DELIVERY_STATUS_LABEL[entry.status]}` : ''}`}
      className={`aspect-square rounded-md text-sm disabled:opacity-35 ${background} ${border}`}
    >
      {Number(date.slice(8))}
    </button>
  );
}

'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  dayProducts,
  dayStatus,
  firstOfMonth,
  formatBillingMonth,
  formatQuantity,
  lastOfMonth,
  shiftMonth,
  todayInBusinessTimezone,
  type DeliveryStatus,
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
import { getCachedCustomer, getCachedMilkTypes } from '@/lib/db/cache-repo';
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
  const milkTypes = useLive(getCachedMilkTypes, []);
  const entries = useLive(
    async () => {
      const byDate = new Map<string, LocalDelivery[]>();
      for (const d of await listLocalDeliveriesForCustomerInRange(
        customerId,
        month,
        lastOfMonth(month),
      )) {
        byDate.set(d.delivery_date, [...(byDate.get(d.delivery_date) ?? []), d]);
      }
      return byDate;
    },
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

  if (customer === undefined || entries === undefined || milkTypes === undefined) {
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

  const selectedIsToday = selectedDate === today;
  const selectedEntries = selectedDate ? (entries.get(selectedDate) ?? []) : [];
  const selectedProducts = selectedIsToday
    ? dayProducts(customer, selectedEntries)
    : // A past day shows what was recorded: the products may have changed since.
      selectedEntries.map((delivery) => ({
        milkTypeId: delivery.milk_type_id,
        quantity: delivery.scheduled_quantity_ml,
        delivery,
      }));
  const productName = (milkTypeId: string) => milkTypes[milkTypeId]?.name ?? 'Product';

  async function handleMark(
    { milkTypeId, quantity, delivery }: (typeof selectedProducts)[number],
    status: 'completed' | 'missed',
  ) {
    if (!customer) return;
    if (todayInBusinessTimezone() !== today) {
      dialogRef.current?.close();
      setError('The date has changed. Reopen this customer to mark today’s delivery.');
      return;
    }
    const lastToMark = selectedProducts.every(
      (p) => p.milkTypeId === milkTypeId || p.delivery !== null,
    );
    if (delivery?.status === status) {
      if (lastToMark) dialogRef.current?.close();
      return;
    }
    setSaving(true);
    try {
      await recordDelivery({
        customerId: customer.id,
        deliveryDate: today,
        milkTypeId,
        scheduledQuantityMl: quantity,
        deliveredQuantityMl: status === 'completed' ? quantity : 0,
        status,
        // The server requires a reason for anything but a completed delivery.
        reason: status === 'missed' ? 'Marked not delivered by worker' : null,
      });
      setError(null);
      runSync();
    } catch (err) {
      setError(`Not saved: ${err instanceof Error ? err.message : String(err)}`);
      dialogRef.current?.close();
    } finally {
      setSaving(false);
      if (lastToMark) dialogRef.current?.close();
    }
  }

  return (
    <>
      <a href="/today" className="flex min-h-12 w-fit items-center rounded-md border border-border px-4 text-base font-semibold text-text hover:bg-surface-muted">
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
                status={dayStatus((entries.get(date) ?? []).map((d) => d.status))}
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
            {selectedProducts.length === 0 ? <Badge label="No record" /> : null}
          </div>
          {selectedProducts.map(({ milkTypeId, quantity, delivery }) => (
            <div key={milkTypeId}>
              <div className="flex items-center justify-between gap-2">
                <span>
                  {productName(milkTypeId)} ·{' '}
                  {formatQuantity(
                    delivery?.delivered_quantity_ml || quantity,
                    milkTypes[milkTypeId]?.unit,
                  )}
                </span>
                {delivery ? (
                  <Badge
                    label={DELIVERY_STATUS_LABEL[delivery.status]}
                    tone={DELIVERY_STATUS_TONE[delivery.status]}
                  />
                ) : (
                  <Badge label="Not marked yet" />
                )}
              </div>
              {delivery?.reason ? (
                <p className="text-sm text-text-secondary">Note: {delivery.reason}</p>
              ) : null}
            </div>
          ))}
          {selectedIsToday ? (
            selectedProducts.every((p) => p.delivery?.status === 'completed') ? (
              <p className="text-sm text-text-secondary">
                Delivery already confirmed for today — this can no longer be changed here.
              </p>
            ) : (
              <Button onClick={() => dialogRef.current?.showModal()}>
                Mark today&rsquo;s delivery
              </Button>
            )
          ) : null}
          {!selectedIsToday && selectedEntries.length === 0 ? (
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
            Delivered today?
          </h2>
          <p className="text-text-secondary">{customer.full_name}</p>
          {(selectedIsToday ? selectedProducts : []).map((product) => (
            <div
              key={product.milkTypeId}
              role="group"
              aria-label={productName(product.milkTypeId)}
              className="flex flex-col gap-2 border-t border-border pt-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {productName(product.milkTypeId)} ·{' '}
                  {formatQuantity(product.quantity, milkTypes[product.milkTypeId]?.unit)}
                </span>
                {product.delivery ? (
                  <Badge
                    label={DELIVERY_STATUS_LABEL[product.delivery.status]}
                    tone={DELIVERY_STATUS_TONE[product.delivery.status]}
                  />
                ) : null}
              </div>
              {product.delivery?.status !== 'completed' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => handleMark(product, 'completed')} disabled={saving}>
                    Delivered
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleMark(product, 'missed')}
                    disabled={saving}
                  >
                    Not delivered
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
            Close
          </Button>
        </div>
      </dialog>
    </>
  );
}

function DayCell({
  date,
  today,
  status,
  selected,
  onSelect,
}: {
  date: string;
  today: string;
  status: DeliveryStatus | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const isToday = date === today;
  const background = status
    ? TONE_CLASSES[DELIVERY_STATUS_TONE[status]]
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
      aria-label={`${date}${status ? `, ${DELIVERY_STATUS_LABEL[status]}` : ''}`}
      className={`aspect-square rounded-md text-sm disabled:opacity-35 ${background} ${border}`}
    >
      {Number(date.slice(8))}
    </button>
  );
}

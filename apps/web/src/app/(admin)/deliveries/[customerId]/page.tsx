import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  BILL_STATUS_LABEL,
  BILL_STATUS_TONE,
  dayProducts,
  dayStatus,
  type DeliveryStatus,
  firstOfMonth,
  formatDateTime,
  formatDateWithWeekday,
  formatPaiseAsRupees,
  formatQuantity,
  formatQuantityTotal,
  lastOfMonth,
  type ProductUnit,
  shiftDate,
  shiftMonth,
  todayInBusinessTimezone,
} from '@shreeram/shared';

import { ActionForm } from '@/components/action-form';
import {
  Badge,
  Card,
  EmptyState,
  InfoButton,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  WarningButton,
} from '@/components/ui';
import { listBillsForCustomer } from '@/lib/data/bills';
import {
  listConflictingEvents,
  listDeliveriesForCustomerInRange,
  type DeliveryRow,
} from '@/lib/data/deliveries';
import { getCustomer } from '@/lib/data/customers';
import { listAllMilkTypes } from '@/lib/data/milk-types';
import { createClient } from '@/lib/supabase/server';

import { createBillForMonthAction, markSkippedAction, resolveConflictAction } from './actions';

type PageProps = {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ month?: string; day?: string }>;
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  completed: 'Delivered',
  partial: 'Partial',
  missed: 'Missed',
  skipped: 'Customer informed — no delivery',
};

const STATUS_TONE: Record<DeliveryStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  partial: 'warning',
  missed: 'danger',
  skipped: 'warning',
};

const DAY_CELL_CLASS: Record<DeliveryStatus | 'no_record' | 'future', string> = {
  completed: 'bg-success-bg text-success border-transparent',
  partial: 'bg-warning-bg text-warning border-transparent',
  missed: 'bg-danger-bg text-danger border-transparent',
  skipped: 'bg-warning-bg text-warning border-transparent',
  no_record: 'bg-surface text-text-secondary border-border hover:bg-surface-muted',
  future: 'bg-surface text-text-secondary/40 border-border/60',
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export default async function CustomerDeliveryCalendarPage({ params, searchParams }: PageProps) {
  const { customerId } = await params;
  const sp = await searchParams;
  const today = todayInBusinessTimezone();
  const month = sp.month ?? firstOfMonth(today);
  const day = sp.day ?? null;

  const supabase = await createClient();
  const [customer, deliveries, bills, milkTypes] = await Promise.all([
    getCustomer(supabase, customerId),
    listDeliveriesForCustomerInRange(supabase, customerId, month, lastOfMonth(month)),
    listBillsForCustomer(supabase, customerId),
    listAllMilkTypes(supabase),
  ]);
  const productById = new Map(milkTypes.map((m) => [m.id, m]));

  if (!customer) notFound();

  const entriesByDate = new Map<string, DeliveryRow[]>();
  for (const d of deliveries) {
    entriesByDate.set(d.delivery_date, [...(entriesByDate.get(d.delivery_date) ?? []), d]);
  }
  const statusOn = (date: string) =>
    dayStatus((entriesByDate.get(date) ?? []).map((d) => d.status));
  const grid = buildMonthGrid(month);

  const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const countedThrough = month <= firstOfMonth(today) ? (month === firstOfMonth(today) ? today : lastOfMonth(month)) : null;
  const summary = { completed: 0, partial: 0, missed: 0, skipped: 0, noRecord: 0, daysDelivered: 0 };
  const delivered: { quantity: number; unit: ProductUnit | undefined }[] = [];
  if (countedThrough) {
    for (let d = month; d <= countedThrough; d = shiftDate(d, 1)) {
      const entries = entriesByDate.get(d) ?? [];
      if (entries.length === 0) summary.noRecord += 1;
      if (entries.some((e) => e.status === 'completed' || e.status === 'partial')) {
        summary.daysDelivered += 1;
      }
      for (const entry of entries) {
        summary[entry.status] += 1;
        delivered.push({
          quantity: entry.delivered_quantity_ml,
          unit: productById.get(entry.milk_type_id)?.unit,
        });
      }
    }
  }

  const bill =
    bills.find((b) => b.billing_month === month && b.status !== 'voided') ??
    bills.find((b) => b.billing_month === month) ??
    null;

  const selectedEntries = day ? (entriesByDate.get(day) ?? []) : [];
  const conflictingEvents =
    day && selectedEntries.some((e) => e.has_conflict)
      ? await listConflictingEvents(supabase, customerId, day)
      : [];
  const selectedProducts =
    day === today ? dayProducts(customer, selectedEntries) : recordedProducts(selectedEntries);
  const canMarkSkipped =
    !!day && !selectedEntries.some((e) => e.status === 'completed' || e.status === 'partial');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={customer.full_name}
        description={`${customer.address} · ${customer.mobile_number}`}
        actions={
          <Link href="/deliveries">
            <SecondaryButton type="button">Back to Deliveries</SecondaryButton>
          </Link>
        }
      />

      <Card>
        <div className="mx-auto w-full max-w-xs">
          <div className="mb-3 flex items-center justify-between">
            <Link href={`?month=${shiftMonth(month, -1)}`}>
              <SecondaryButton type="button">
                ‹
              </SecondaryButton>
            </Link>
            <h2 className="text-sm font-semibold text-text">{monthLabel}</h2>
            <Link href={`?month=${shiftMonth(month, 1)}`}>
              <SecondaryButton type="button">
                ›
              </SecondaryButton>
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {grid.map((week, i) => (
              <div key={i} className="grid grid-cols-7 gap-1">
                {week.map((date, j) => {
                  if (!date) return <div key={j} className="aspect-square" />;
                  const isFuture = date > today;
                  const key: DeliveryStatus | 'no_record' | 'future' = isFuture
                    ? 'future'
                    : (statusOn(date) ?? 'no_record');
                  const isSelected = date === day;
                  const isToday = date === today;
                  return (
                    <Link key={date} href={`?month=${month}&day=${date}`}>
                      <div
                        className={`flex aspect-square items-center justify-center rounded-md border text-xs font-medium transition ${DAY_CELL_CLASS[key]} ${
                          isSelected
                            ? 'ring-2 ring-primary ring-offset-1'
                            : isToday
                              ? 'ring-1 ring-primary'
                              : ''
                        }`}
                      >
                        {Number(date.slice(8, 10))}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-text-secondary">
            <LegendDot className="bg-success-bg" label="Delivered" />
            <LegendDot className="bg-danger-bg" label="Missed" />
            <LegendDot className="bg-warning-bg" label="Partial / customer informed" />
            <LegendDot className="border border-border bg-surface" label="No record" />
          </div>
        </div>
      </Card>

      {day ? (
        // Keyed so an error from one day doesn't stay on screen for the next.
        <Card key={day}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">
              {formatDateWithWeekday(day)}
            </h2>
            {selectedProducts.length === 0 ? <Badge label="No record" tone="neutral" /> : null}
          </div>
          <ul className="mb-3 flex flex-col gap-2">
            {selectedProducts.map(({ milkTypeId, quantity, delivery }) => {
              const product = productById.get(milkTypeId);
              return (
                <li key={milkTypeId} className="text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text">
                      {product?.name ?? 'Product'} ·{' '}
                      {formatQuantity(delivery?.delivered_quantity_ml ?? quantity, product?.unit)}
                      {delivery ? '' : ' scheduled'}
                    </span>
                    {delivery ? (
                      <Badge label={STATUS_LABEL[delivery.status]} tone={STATUS_TONE[delivery.status]} />
                    ) : (
                      <Badge label="No record" tone="neutral" />
                    )}
                  </div>
                  {delivery?.reason ? (
                    <p className="text-text-secondary">Note: {delivery.reason}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {selectedEntries.filter((e) => e.has_conflict).map((entry) => (
            <div key={entry.id} className="mb-4 rounded-md border border-warning bg-warning-bg p-4">
              <p className="font-medium text-warning">
                Conflict: two different {productById.get(entry.milk_type_id)?.name ?? 'product'} records
                for this day
              </p>
              <p className="mt-1 text-sm text-text">
                Choose which one is right. Using the other record can change this month&rsquo;s bill.
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                <ConflictRecord
                  heading="Current record"
                  status={entry.status}
                  quantity={formatQuantity(
                    entry.delivered_quantity_ml,
                    productById.get(entry.milk_type_id)?.unit,
                  )}
                  reason={entry.reason}
                  recordedAt={entry.device_recorded_at}
                  action={resolveConflictAction.bind(null, customerId, day, month, entry.id, null)}
                  button="Keep this record"
                />
                {conflictingEvents
                  .filter((event) => event.payload.milk_type_id === entry.milk_type_id)
                  .map((event) => (
                  <ConflictRecord
                    key={event.id}
                    heading="Other record from the worker&rsquo;s phone"
                    status={event.payload.status as DeliveryStatus}
                    quantity={formatQuantity(
                      Number(event.payload.delivered_quantity_ml),
                      productById.get(entry.milk_type_id)?.unit,
                    )}
                    reason={event.payload.reason as string | null}
                    recordedAt={event.device_recorded_at}
                    action={resolveConflictAction.bind(null, customerId, day, month, entry.id, event.id)}
                    button="Use this record"
                  />
                ))}
              </ul>
            </div>
          ))}

          {canMarkSkipped ? (
            <ActionForm
              action={markSkippedAction.bind(null, customerId, day, month)}
              className="flex flex-col gap-2"
            >
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Reason (shown to the business, e.g. &ldquo;Customer on vacation till 5th&rdquo;)
                <input
                  name="reason"
                  defaultValue={selectedEntries[0]?.reason ?? ''}
                  placeholder="Customer informed — no delivery"
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
                />
              </label>
              <div className="flex justify-end">
                <WarningButton type="submit">Mark &ldquo;customer informed — no delivery&rdquo;</WarningButton>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-text-secondary">
              This day already has a recorded delivery — it can&rsquo;t be marked skipped here.
            </p>
          )}
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">
          {monthLabel} summary{countedThrough ? null : ' (upcoming month)'}
        </h2>
        {countedThrough ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Delivered" value={summary.completed + summary.partial} />
            <Stat label="Missed" value={summary.missed} />
            <Stat label="Customer informed" value={summary.skipped} />
            <Stat label="Days with no record" value={summary.noRecord} />
          </div>
        ) : (
          <p className="text-sm text-text-secondary">This month hasn&rsquo;t started yet.</p>
        )}
        {countedThrough ? (
          <p className="mt-3 text-sm text-text-secondary">
            Total delivered: {formatQuantityTotal(delivered)} across{' '}
            {summary.daysDelivered} day{summary.daysDelivered === 1 ? '' : 's'}.
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Bill for {monthLabel}</h2>
        {bill ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge label={BILL_STATUS_LABEL[bill.status]} tone={BILL_STATUS_TONE[bill.status]} />
              <p className="mt-2 text-sm text-text-secondary">
                {bill.bill_number} · Total payable {formatPaiseAsRupees(bill.total_payable_paise)}
              </p>
            </div>
            <Link href={`/billing/${bill.id}`}>
              <InfoButton type="button">View &amp; share bill (PDF) →</InfoButton>
            </Link>
          </div>
        ) : (
          <EmptyState
            title="No bill created for this month yet"
            description="Create a draft bill to see totals and share a PDF with the customer."
          />
        )}
        {!bill ? (
          <ActionForm
            key={month}
            action={createBillForMonthAction.bind(null, customerId, month)}
            className="mt-3 flex justify-end"
          >
            <PrimaryButton type="submit">Create draft bill for {monthLabel}</PrimaryButton>
          </ActionForm>
        ) : null}
      </Card>
    </div>
  );
}

/** A past day shows what was recorded: the customer's products may have changed since. */
function recordedProducts(entries: DeliveryRow[]) {
  return entries.map((delivery) => ({
    milkTypeId: delivery.milk_type_id,
    quantity: delivery.scheduled_quantity_ml,
    delivery,
  }));
}

function ConflictRecord({
  heading,
  status,
  quantity,
  reason,
  recordedAt,
  action,
  button,
}: {
  heading: string;
  status: DeliveryStatus;
  quantity: string;
  reason: string | null;
  recordedAt: string;
  action: () => Promise<{ error: string | null }>;
  button: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
      <div>
        <p className="text-sm font-medium text-text">{heading}</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
          <Badge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} /> {quantity}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Recorded{' '}
          {formatDateTime(recordedAt)}
          {reason ? ` · ${reason}` : ''}
        </p>
      </div>
      <ActionForm action={action}>
        <PrimaryButton type="submit">{button}</PrimaryButton>
      </ActionForm>
    </li>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface-muted px-3 py-2">
      <p className="text-xl font-semibold text-text">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  BILL_STATUS_LABEL,
  BILL_STATUS_TONE,
  firstOfMonth,
  formatPaiseAsRupees,
  lastOfMonth,
  shiftDate,
  shiftMonth,
  todayInBusinessTimezone,
  type DeliveryStatus,
} from '@shreeram/shared';

import { Badge, Card, EmptyState, PageHeader, PrimaryButton, SecondaryButton } from '@/components/ui';
import { listBillsForCustomer } from '@/lib/data/bills';
import { listDeliveriesForCustomerInRange, type DeliveryRow } from '@/lib/data/deliveries';
import { getCustomer } from '@/lib/data/customers';
import { createClient } from '@/lib/supabase/server';

import { createBillForMonthAction, markSkippedAction } from './actions';

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
  partial: 'success',
  missed: 'danger',
  skipped: 'warning',
};

const DAY_CELL_CLASS: Record<DeliveryStatus | 'no_record' | 'future', string> = {
  completed: 'bg-success-bg text-success',
  partial: 'bg-success-bg text-success',
  missed: 'bg-danger-bg text-danger',
  skipped: 'bg-warning-bg text-warning',
  no_record: 'bg-surface text-text-secondary',
  future: 'bg-surface text-text-secondary opacity-40',
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
  const [customer, deliveries, bills] = await Promise.all([
    getCustomer(supabase, customerId),
    listDeliveriesForCustomerInRange(supabase, customerId, month, lastOfMonth(month)),
    listBillsForCustomer(supabase, customerId),
  ]);

  if (!customer) notFound();

  const entriesByDate = new Map<string, DeliveryRow>(deliveries.map((d) => [d.delivery_date, d]));
  const grid = buildMonthGrid(month);

  const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const countedThrough = month <= firstOfMonth(today) ? (month === firstOfMonth(today) ? today : lastOfMonth(month)) : null;
  const summary = { completed: 0, partial: 0, missed: 0, skipped: 0, noRecord: 0, totalMl: 0 };
  if (countedThrough) {
    for (let d = month; d <= countedThrough; d = shiftDate(d, 1)) {
      const entry = entriesByDate.get(d);
      if (!entry) {
        summary.noRecord += 1;
      } else {
        summary[entry.status as 'completed' | 'partial' | 'missed' | 'skipped'] += 1;
        summary.totalMl += entry.delivered_quantity_ml;
      }
    }
  }

  const bill =
    bills.find((b) => b.billing_month === month && b.status !== 'voided') ??
    bills.find((b) => b.billing_month === month) ??
    null;

  const selectedEntry = day ? entriesByDate.get(day) : undefined;
  const canMarkSkipped = !!day && selectedEntry?.status !== 'completed' && selectedEntry?.status !== 'partial';

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
        <div className="mb-4 flex items-center justify-between">
          <Link href={`?month=${shiftMonth(month, -1)}`}>
            <SecondaryButton type="button">‹ Prev</SecondaryButton>
          </Link>
          <h2 className="text-lg font-semibold text-text">{monthLabel}</h2>
          <Link href={`?month=${shiftMonth(month, 1)}`}>
            <SecondaryButton type="button">Next ›</SecondaryButton>
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-text-secondary">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        {grid.map((week, i) => (
          <div key={i} className="grid grid-cols-7 gap-1">
            {week.map((date, j) => {
              if (!date) return <div key={j} className="aspect-square" />;
              const entry = entriesByDate.get(date);
              const isFuture = date > today;
              const key: DeliveryStatus | 'no_record' | 'future' = isFuture
                ? 'future'
                : (entry?.status ?? 'no_record');
              const isSelected = date === day;
              const isToday = date === today;
              return (
                <Link key={date} href={`?month=${month}&day=${date}`}>
                  <div
                    className={`flex aspect-square items-center justify-center rounded-md text-sm transition ${DAY_CELL_CLASS[key]} ${
                      isSelected ? 'ring-2 ring-primary' : isToday ? 'ring-1 ring-primary' : ''
                    }`}
                  >
                    {Number(date.slice(8, 10))}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-secondary">
          <LegendDot className="bg-success-bg" label="Delivered" />
          <LegendDot className="bg-danger-bg" label="Missed" />
          <LegendDot className="bg-warning-bg" label="Customer informed — no delivery" />
          <LegendDot className="bg-surface border border-border" label="No record" />
        </div>
      </Card>

      {day ? (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">
              {new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </h2>
            {selectedEntry ? (
              <Badge label={STATUS_LABEL[selectedEntry.status]} tone={STATUS_TONE[selectedEntry.status]} />
            ) : (
              <Badge label="No record" tone="neutral" />
            )}
          </div>
          {selectedEntry?.reason ? (
            <p className="mb-3 text-sm text-text-secondary">Note: {selectedEntry.reason}</p>
          ) : null}

          {canMarkSkipped ? (
            <form action={markSkippedAction.bind(null, customerId, day, month)} className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Reason (shown to the business, e.g. &ldquo;Customer on vacation till 5th&rdquo;)
                <input
                  name="reason"
                  defaultValue={selectedEntry?.reason ?? ''}
                  placeholder="Customer informed — no delivery"
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
                />
              </label>
              <div>
                <PrimaryButton type="submit">Mark &ldquo;customer informed — no delivery&rdquo;</PrimaryButton>
              </div>
            </form>
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
            <Stat label="No record" value={summary.noRecord} />
          </div>
        ) : (
          <p className="text-sm text-text-secondary">This month hasn&rsquo;t started yet.</p>
        )}
        {countedThrough ? (
          <p className="mt-3 text-sm text-text-secondary">
            Total delivered: {(summary.totalMl / 1000).toFixed(2)} L across{' '}
            {summary.completed + summary.partial} day{summary.completed + summary.partial === 1 ? '' : 's'}.
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
              <PrimaryButton type="button">View &amp; share bill (PDF) →</PrimaryButton>
            </Link>
          </div>
        ) : (
          <EmptyState
            title="No bill created for this month yet"
            description="Create a draft bill to see totals and share a PDF with the customer."
          />
        )}
        {!bill ? (
          <form action={createBillForMonthAction.bind(null, customerId, month)} className="mt-3">
            <PrimaryButton type="submit">Create draft bill for {monthLabel}</PrimaryButton>
          </form>
        ) : null}
      </Card>
    </div>
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

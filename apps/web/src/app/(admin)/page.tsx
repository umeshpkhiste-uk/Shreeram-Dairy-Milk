import Link from 'next/link';

import { computeDashboardMetrics, formatPaiseAsRupees, todayInBusinessTimezone } from '@shreeram/shared';

import { Card, PageHeader } from '@/components/ui';
import { listCustomers } from '@/lib/data/customers';
import { listDeliveriesForDate } from '@/lib/data/deliveries';
import { listWorkers } from '@/lib/data/workers';
import { createClient } from '@/lib/supabase/server';

import { DashboardDatePicker } from './dashboard-date-picker';

type PageProps = { searchParams: Promise<{ date?: string }> };

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const today = todayInBusinessTimezone();
  const sp = await searchParams;
  const date = sp.date && sp.date <= today ? sp.date : today;
  const isToday = date === today;

  const [activeCustomers, workers, deliveriesForDate] = await Promise.all([
    listCustomers(supabase, { status: 'active' }),
    listWorkers(supabase),
    listDeliveriesForDate(supabase, date),
  ]);

  const metrics = computeDashboardMetrics(activeCustomers, workers, deliveriesForDate, date);

  const tiles: { label: string; value: string; href?: string }[] = [
    { label: 'Active customers', value: String(metrics.activeCustomers), href: '/customers' },
    { label: 'Active workers', value: String(metrics.activeWorkers), href: '/workers' },
    { label: 'Scheduled', value: String(metrics.scheduledToday) },
    { label: 'Completed', value: String(metrics.completedToday), href: '/deliveries' },
    { label: 'Partial', value: String(metrics.partialToday), href: '/deliveries' },
    { label: 'Missed', value: String(metrics.missedToday), href: '/deliveries' },
    { label: 'No record yet', value: String(metrics.noRecordToday), href: '/deliveries' },
    { label: 'Milk delivered', value: `${(metrics.totalMlDeliveredToday / 1000).toFixed(1)} L` },
    {
      label: 'Estimated sales',
      value: formatPaiseAsRupees(metrics.estimatedSalesPaiseToday),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`${date}${isToday ? ' (today)' : ''} · Asia/Kolkata`}
        actions={<DashboardDatePicker date={date} />}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => {
          const content = (
            <Card key={tile.label} className="h-full">
              <p className="text-sm text-text-secondary">{tile.label}</p>
              <p className="mt-2 text-2xl font-semibold text-text">{tile.value}</p>
            </Card>
          );
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className="block">
              {content}
            </Link>
          ) : (
            content
          );
        })}
      </div>
      <p className="mt-6 text-xs text-text-secondary">
        &ldquo;No record yet&rdquo; means no delivery had reached the server for that customer on
        this date (as of now) — it is not proof of a missed delivery; it may still be in an
        offline worker&rsquo;s sync queue.
      </p>
    </div>
  );
}

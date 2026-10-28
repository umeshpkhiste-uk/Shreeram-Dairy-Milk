import { todayInBusinessTimezone } from '@shreeram/shared';

import { Badge, Card, EmptyState, PageHeader, Table } from '@/components/ui';
import { listDailyDeliveryReport } from '@/lib/data/deliveries';
import { listRoutes, listWorkers } from '@/lib/data/workers';
import { createClient } from '@/lib/supabase/server';

type PageProps = {
  searchParams: Promise<{
    date?: string;
    workerId?: string;
    routeId?: string;
    status?: string;
    search?: string;
  }>;
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completed',
  partial: 'Partial',
  missed: 'Missed',
  no_record: 'No record yet',
};

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  partial: 'warning',
  missed: 'danger',
  no_record: 'neutral',
};

export default async function DeliveriesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const date = sp.date ?? todayInBusinessTimezone();
  const supabase = await createClient();

  const [rows, workers, routes] = await Promise.all([
    listDailyDeliveryReport(supabase, {
      date,
      workerId: sp.workerId,
      routeId: sp.routeId,
      customerSearch: sp.search,
      status: (sp.status as never) || null,
    }),
    listWorkers(supabase),
    listRoutes(supabase),
  ]);

  return (
    <div>
      <PageHeader title="Daily deliveries" description={date} />

      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="flex flex-col gap-1 text-sm font-medium text-text">
            Date
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-text">
            Worker
            <select
              name="workerId"
              defaultValue={sp.workerId ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
            >
              <option value="">All workers</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-text">
            Route
            <select
              name="routeId"
              defaultValue={sp.routeId ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
            >
              <option value="">All routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-text">
            Status
            <select
              name="status"
              defaultValue={sp.status ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
            >
              <option value="">Any status</option>
              <option value="completed">Completed</option>
              <option value="partial">Partial</option>
              <option value="missed">Missed</option>
              <option value="no_record">No record yet</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-text">
            Customer search
            <input
              name="search"
              defaultValue={sp.search ?? ''}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-muted"
          >
            Apply
          </button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No customers match these filters" />
      ) : (
        <Table>
          <thead className="bg-surface-muted text-xs font-medium uppercase text-text-secondary">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const statusKey = row.delivery?.status ?? 'no_record';
              return (
                <tr key={row.customer.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3 font-medium text-text">{row.customer.full_name}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {row.delivery
                      ? `${row.delivery.delivered_quantity_ml} ml`
                      : `${row.customer.default_daily_quantity_ml} ml scheduled`}
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={STATUS_LABEL[statusKey]} tone={STATUS_TONE[statusKey]} />
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{row.delivery?.reason ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <p className="mt-6 text-xs text-text-secondary">
        &ldquo;No record yet&rdquo; is never shown as &ldquo;Missed&rdquo; — it only means no
        delivery row has reached the server yet for that customer today.
      </p>
    </div>
  );
}

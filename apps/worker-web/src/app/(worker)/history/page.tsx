'use client';

import { shiftDate, todayInBusinessTimezone } from '@shreeram/shared';

import { Card, EmptyState, LoadingState, Title } from '@/components/ui';
import { listCachedCustomers } from '@/lib/db/cache-repo';
import { listLocalDeliveriesSince } from '@/lib/db/deliveries-repo';
import { useLive } from '@/lib/db/use-live';
import { HISTORY_DAYS, summarizeHistory } from '@/lib/history-summary';

/** Customer-wise entry point — tapping a card opens that customer's numbers-only summary. */
export default function DeliveryHistoryPage() {
  const summaries = useLive(async () => {
    const customers = await listCachedCustomers();
    const deliveries = await listLocalDeliveriesSince(
      shiftDate(todayInBusinessTimezone(), -HISTORY_DAYS),
    );
    return customers
      .map((customer) => ({
        customer,
        ...summarizeHistory(deliveries.filter((d) => d.customer_id === customer.id)),
      }))
      .filter((s) => s.delivered + s.missed + s.skipped > 0);
  }, []);

  if (!summaries) return <LoadingState label="Loading history…" />;

  return (
    <>
      <Title>Delivery History</Title>
      {summaries.length === 0 ? (
        <EmptyState
          title="No deliveries recorded yet"
          description="Deliveries you record on Today’s Route appear here, grouped by customer."
        />
      ) : (
        summaries.map(({ customer, delivered, missed, skipped }) => (
          <a key={customer.id} href={`/history/customer?id=${customer.id}`}>
            <Card className="flex flex-col gap-1">
              <span className="text-lg font-semibold">{customer.full_name}</span>
              <span className="text-text-secondary">{customer.address}</span>
              <span className="text-sm text-text-secondary">
                {delivered} delivered · {missed} missed · {skipped} skipped
              </span>
            </Card>
          </a>
        ))
      )}
    </>
  );
}

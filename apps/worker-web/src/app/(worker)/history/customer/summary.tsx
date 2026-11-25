'use client';

import { useSearchParams } from 'next/navigation';

import { formatQuantityTotal, shiftDate, todayInBusinessTimezone } from '@shreeram/shared';

import { Card, EmptyState, LoadingState, Row, Title } from '@/components/ui';
import { getCachedCustomer, getCachedMilkTypes } from '@/lib/db/cache-repo';
import { listLocalDeliveriesForCustomerInRange } from '@/lib/db/deliveries-repo';
import { useLive } from '@/lib/db/use-live';
import { HISTORY_DAYS, summarizeHistory } from '@/lib/history-summary';

/** Numbers-only summary for one customer — counts and total quantity, no per-day rows. */
export function CustomerDeliverySummary() {
  const customerId = useSearchParams().get('id') ?? '';
  const data = useLive(async () => {
    const today = todayInBusinessTimezone();
    return {
      customer: await getCachedCustomer(customerId),
      milkTypes: await getCachedMilkTypes(),
      deliveries: await listLocalDeliveriesForCustomerInRange(
        customerId,
        shiftDate(today, -HISTORY_DAYS),
        today,
      ),
    };
  }, [customerId]);

  if (!data) return <LoadingState label="Loading summary…" />;
  if (!data.customer) {
    return (
      <EmptyState
        title="Customer not found"
        description="This customer may no longer be assigned to you."
      />
    );
  }

  const summary = summarizeHistory(data.deliveries);
  return (
    <>
      <a href="/history" className="flex min-h-12 w-fit items-center text-primary">
        ‹ Delivery History
      </a>
      <Title>{data.customer.full_name}</Title>
      <p className="text-text-secondary">{data.customer.address}</p>
      {data.deliveries.length === 0 ? (
        <EmptyState
          title="No deliveries recorded yet"
          description={`No deliveries in the last ${HISTORY_DAYS} days.`}
        />
      ) : (
        <Card className="flex flex-col gap-2">
          <Row label="Days delivered" value={summary.delivered} />
          <Row label="Days missed" value={summary.missed} />
          <Row label="Days skipped" value={summary.skipped} />
          <Row
            label="Total quantity"
            value={formatQuantityTotal(
              summary.quantities.map(({ milkTypeId, quantity }) => ({
                quantity,
                unit: data.milkTypes[milkTypeId]?.unit,
              })),
            )}
          />
        </Card>
      )}
    </>
  );
}

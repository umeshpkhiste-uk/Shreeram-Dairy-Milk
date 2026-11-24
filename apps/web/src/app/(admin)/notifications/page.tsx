import { todayInBusinessTimezone } from '@shreeram/shared';

import { AttentionList } from '@/components/attention-list';
import { EmptyState, PageHeader } from '@/components/ui';
import { listNotificationItems } from '@/lib/data/attention';
import { createClient } from '@/lib/supabase/server';

export default async function NotificationsPage() {
  const items = await listNotificationItems(await createClient(), todayInBusinessTimezone());

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Delivery conflicts, flagged bills, and today's missed or unrecorded deliveries."
      />
      {items.length === 0 ? (
        <EmptyState title="All clear" description="Nothing needs your attention." />
      ) : (
        <AttentionList items={items} />
      )}
    </div>
  );
}

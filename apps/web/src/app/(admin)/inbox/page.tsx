import { AttentionList } from '@/components/attention-list';
import { EmptyState, PageHeader } from '@/components/ui';
import { listInboxItems } from '@/lib/data/attention';
import { createClient } from '@/lib/supabase/server';

export default async function InboxPage() {
  const items = await listInboxItems(await createClient());

  return (
    <div>
      <PageHeader title="Inbox" description="Payments to check and draft bills to generate and send." />
      {items.length === 0 ? (
        <EmptyState title="Nothing waiting" description="There are no payments to check or draft bills." />
      ) : (
        <AttentionList items={items} />
      )}
    </div>
  );
}

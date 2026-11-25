import { AttentionList } from '@/components/attention-list';
import { EmptyState, PageHeader } from '@/components/ui';
import { listInboxItems } from '@/lib/data/attention';
import { createClient } from '@/lib/supabase/server';

export default async function InboxPage() {
  const items = await listInboxItems(await createClient());

  return (
    <div>
      <PageHeader title="Inbox" description="Draft bills waiting to be generated and sent." />
      {items.length === 0 ? (
        <EmptyState title="Nothing waiting" description="There are no draft bills." />
      ) : (
        <AttentionList items={items} />
      )}
    </div>
  );
}

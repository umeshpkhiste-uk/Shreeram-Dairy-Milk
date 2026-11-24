import Link from 'next/link';

import { Badge } from '@/components/ui';
import type { AttentionItem } from '@/lib/data/attention';

/** The Inbox and Notifications pages' shared list. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface-muted"
          >
            <span className="min-w-0">
              <span className="block font-medium text-text">{item.title}</span>
              <span className="block text-sm text-text-secondary">{item.detail}</span>
            </span>
            <Badge label={item.label} tone={item.tone} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

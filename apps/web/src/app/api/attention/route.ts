import { NextResponse } from 'next/server';

import { todayInBusinessTimezone } from '@shreeram/shared';

import { requireAdmin } from '@/lib/auth';
import { listInboxItems, listNotificationItems } from '@/lib/data/attention';
import { createClient } from '@/lib/supabase/server';

/**
 * The menu's Inbox/Notifications counts. Fetched by the menu itself rather
 * than loaded in the admin layout: a layout doesn't re-run on navigation, so
 * its counts would go stale, and it would delay every page's first render.
 */
export async function GET() {
  const supabase = await createClient();
  await requireAdmin(supabase);

  // Runs on every page, so a change that starts today shows up.
  await supabase.rpc('apply_due_product_changes');
  const [inbox, notifications] = await Promise.all([
    listInboxItems(supabase),
    listNotificationItems(supabase, todayInBusinessTimezone()),
  ]);
  return NextResponse.json({ inbox: inbox.length, notifications: notifications.length });
}

import type { ReactNode } from 'react';

import { signOut } from '@/app/login/actions';
import { AdminNavShell } from '@/components/admin-nav-shell';
import { requireAdmin } from '@/lib/auth';
import { getBusinessSettings } from '@/lib/data/business-settings';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin();
  const supabase = await createClient();
  const business = await getBusinessSettings(supabase);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminNavShell
        fullName={profile.full_name}
        businessName={business.business_name}
        address={business.address}
        signOutAction={signOut}
      />
      <main className="flex-1 overflow-y-auto bg-surface-muted p-6 md:p-10">{children}</main>
    </div>
  );
}

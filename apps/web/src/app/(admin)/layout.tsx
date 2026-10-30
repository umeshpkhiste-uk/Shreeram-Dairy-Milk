import type { ReactNode } from 'react';

import { signOut } from '@/app/login/actions';
import { AdminHeader } from '@/components/admin-header';
import { AdminNavShell } from '@/components/admin-nav-shell';
import { requireAdmin } from '@/lib/auth';
import { getBusinessSettings } from '@/lib/data/business-settings';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const [{ profile }, business] = await Promise.all([
    requireAdmin(supabase),
    getBusinessSettings(supabase),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader businessName={business.business_name} tagline={business.tagline} address={business.address} />
      <div className="flex flex-1 flex-col md:flex-row">
        <AdminNavShell fullName={profile.full_name} signOutAction={signOut} />
        <main className="flex-1 overflow-y-auto bg-surface-muted p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}

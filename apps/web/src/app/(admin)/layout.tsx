import type { ReactNode } from 'react';

import { signOut } from '@/app/login/actions';
import { AdminShell } from '@/components/admin-shell';
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
    <AdminShell
      fullName={profile.full_name}
      businessName={business.business_name}
      tagline={business.tagline}
      address={business.address}
      signOutAction={signOut}
    >
      {children}
    </AdminShell>
  );
}

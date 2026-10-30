import type { ReactNode } from 'react';

import { signOut } from '@/app/login/actions';
import { AdminNav } from '@/components/admin-nav';
import { AdminNavShell } from '@/components/admin-nav-shell';
import { requireAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminNavShell fullName={profile.full_name} signOutAction={signOut}>
        <AdminNav />
      </AdminNavShell>
      <main className="flex-1 overflow-y-auto bg-surface-muted p-6 md:p-10">{children}</main>
    </div>
  );
}

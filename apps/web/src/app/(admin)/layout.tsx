import type { ReactNode } from 'react';

import { signOut } from '@/app/login/actions';
import { AdminNav } from '@/components/admin-nav';
import { requireAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <aside className="no-print flex w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6">
        <div className="mb-6 px-2">
          <p className="text-sm font-semibold text-text">Shreeram Daily Milk</p>
          <p className="text-xs text-text-secondary">Admin console</p>
        </div>
        <AdminNav />
        <div className="mt-auto flex flex-col gap-2 px-2 pt-6">
          <p className="truncate text-xs text-text-secondary">Signed in as {profile.full_name}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md border border-border px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-surface-muted"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-surface-muted p-6 md:p-10">{children}</main>
    </div>
  );
}

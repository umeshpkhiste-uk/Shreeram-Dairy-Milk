'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { AdminHeaderContent } from './admin-header';
import { AdminNav } from './admin-nav';

/**
 * A hamburger toggle collapses/expands the sidebar — same mechanism on
 * every screen size (desktop and mobile), not just below a breakpoint.
 * Collapsed, it shrinks to an icon-only rail (every nav item still visible
 * as its icon) rather than disappearing entirely; clicking any icon expands
 * the full sidebar instead of navigating straight away, so the admin can
 * see the labels before picking one.
 *
 * The hamburger + "Admin console" label sit in a fixed-width column at the
 * left of the top bar, matching the sidebar's own width below it; the
 * dealer name/tagline/address fill the rest of the top bar and resize as
 * that column opens/collapses, since both live in one component with one
 * `open` state instead of being laid out independently.
 */
export function AdminShell({
  fullName,
  businessName,
  tagline,
  address,
  signOutAction,
  children,
}: {
  fullName: string;
  businessName: string;
  tagline: string | null;
  address: string | null;
  signOutAction: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const railWidth = open ? 'md:w-64' : 'md:w-14';

  return (
    <div className="flex min-h-screen flex-col">
      <div className="no-print sticky top-0 z-20 flex flex-col border-b border-border bg-surface md:flex-row md:items-stretch">
        <div
          className={`flex shrink-0 items-center gap-2 px-4 py-3 md:border-r md:border-border ${railWidth}`}
        >
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 rounded-md p-2 text-text transition hover:bg-surface-muted"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
              <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
              <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
            </svg>
          </button>
          {open ? <p className="whitespace-nowrap text-xs text-text-secondary">Admin console</p> : null}
        </div>
        <div className="min-w-0 flex-1 px-4 py-3">
          <AdminHeaderContent businessName={businessName} tagline={tagline} address={address} />
        </div>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside
          className={`no-print flex shrink-0 flex-col border-b border-border bg-surface px-4 py-6 transition-[width] md:min-h-full md:border-b-0 md:border-r ${
            open ? 'w-full md:w-64' : 'w-full md:w-14'
          }`}
        >
          <AdminNav collapsed={!open} onExpand={() => setOpen(true)} />

          {open ? (
            <div className="mt-auto flex flex-col gap-2 px-2 pt-6">
              <p className="truncate text-xs text-text-secondary">Signed in as {fullName}</p>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full rounded-md border border-border px-3 py-2 text-left text-sm font-medium text-text transition hover:bg-surface-muted"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : null}
        </aside>
        <main className="flex-1 overflow-y-auto bg-surface-muted p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}

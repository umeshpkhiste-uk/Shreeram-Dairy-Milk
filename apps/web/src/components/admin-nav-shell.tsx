'use client';

import { useState } from 'react';

import { AdminNav } from './admin-nav';

/**
 * A hamburger toggle collapses/expands the sidebar — same mechanism on
 * every screen size (desktop and mobile), not just below a breakpoint.
 * Collapsed, it shrinks to an icon-only rail (every nav item still visible
 * as its icon) rather than disappearing entirely; clicking any icon expands
 * the full sidebar instead of navigating straight away, so the admin can
 * see the labels before picking one.
 */
export function AdminNavShell({
  fullName,
  signOutAction,
}: {
  fullName: string;
  signOutAction: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={`no-print flex shrink-0 flex-col border-b border-border bg-surface px-4 py-6 transition-[width] md:min-h-screen md:border-b-0 md:border-r ${
        open ? 'w-full md:w-64' : 'w-full md:w-14'
      }`}
    >
      <div className="mb-6 flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-md p-2 text-text transition hover:bg-surface-muted"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
            <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
            <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
          </svg>
        </button>
        <p className="text-xs text-text-secondary">Admin console</p>
      </div>

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
  );
}

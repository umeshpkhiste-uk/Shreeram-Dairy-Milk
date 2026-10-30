'use client';

import { useState, type ReactNode } from 'react';

/**
 * On mobile the sidebar used to always render at a fixed width and crowd
 * out the page content. Below `md`, it now collapses behind a hamburger
 * button in a top bar; tapping it again collapses it back. At `md` and
 * above it behaves exactly like the old always-visible sidebar.
 */
export function AdminNavShell({
  fullName,
  signOutAction,
  children,
}: {
  fullName: string;
  signOutAction: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="no-print flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <div>
          <p className="text-sm font-semibold text-text">Shreeram Daily Milk</p>
          <p className="text-xs text-text-secondary">Admin console</p>
        </div>
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 text-text transition hover:bg-surface-muted"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
            <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
            <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <aside
        className={`no-print ${open ? 'flex' : 'hidden'} w-full flex-col border-b border-border bg-surface px-4 py-6 md:flex md:w-64 md:shrink-0 md:border-b-0 md:border-r`}
      >
        <div className="mb-6 hidden px-2 md:block">
          <p className="text-sm font-semibold text-text">Shreeram Daily Milk</p>
          <p className="text-xs text-text-secondary">Admin console</p>
        </div>
        <div onClick={() => setOpen(false)}>{children}</div>
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
      </aside>
    </>
  );
}

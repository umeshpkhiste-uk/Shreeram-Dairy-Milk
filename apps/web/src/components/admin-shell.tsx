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
 * dealer name/tagline fill the rest of the top bar and resize as that
 * column opens/collapses, since both live in one component with one `open`
 * state instead of being laid out independently.
 */
export function AdminShell({
  businessName,
  tagline,
  adminName,
  adminEmail,
  signOutAction,
  children,
}: {
  businessName: string;
  tagline: string | null;
  adminName: string;
  adminEmail: string | null;
  signOutAction: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const railWidth = open ? 'md:w-64' : 'md:w-14';
  const initials =
    adminName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  return (
    <div className="flex min-h-screen flex-col">
      <div className="no-print sticky top-0 z-20 flex flex-col border-b border-border bg-surface md:relative md:flex-row md:items-stretch">
        <div
          className={`flex shrink-0 items-center gap-2 px-4 py-3 md:border-r md:border-border ${railWidth}`}
        >
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 rounded-full border border-border p-1.5 text-text transition hover:bg-surface-muted"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {open ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
            </svg>
          </button>
          {open ? (
            <p className="whitespace-nowrap text-sm font-bold text-text-secondary">Admin console</p>
          ) : null}
        </div>
        {/*
          Centered independently of the rail's width via absolute
          positioning on md+, so it stays put in the middle of the bar
          instead of drifting as the sidebar opens/collapses.
        */}
        <div className="flex justify-center px-4 py-3 md:absolute md:inset-y-0 md:left-1/2 md:-translate-x-1/2 md:px-0 md:py-0">
          <div className="flex items-center">
            <AdminHeaderContent businessName={businessName} tagline={tagline} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside
          className={`no-print flex shrink-0 flex-col border-b border-border bg-surface px-4 py-6 transition-[width] md:min-h-full md:border-b-0 md:border-r ${
            open ? 'w-full md:w-64' : 'w-full md:w-14'
          }`}
        >
          <AdminNav collapsed={!open} onExpand={() => setOpen(true)} />

          <div className={`mt-auto flex items-center gap-2 border-t border-border pt-4 ${open ? '' : 'flex-col'}`}>
            <div
              title={open ? undefined : `${adminName}${adminEmail ? ` · ${adminEmail}` : ''}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-muted text-sm font-semibold text-primary"
            >
              {initials}
            </div>
            {open ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{adminName}</p>
                {adminEmail ? <p className="truncate text-xs text-text-secondary">{adminEmail}</p> : null}
              </div>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="shrink-0 rounded-md p-2 text-text-secondary transition hover:bg-surface-muted hover:text-text"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </form>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto bg-surface-muted p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}

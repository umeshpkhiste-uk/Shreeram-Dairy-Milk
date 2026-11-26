'use client';

import type { ReactNode } from 'react';
import { useRef, useState } from 'react';

import { AdminHeaderContent } from './admin-header';
import { AdminNav } from './admin-nav';
import { Icon } from './icon';
import { ThemeToggle } from './theme-toggle';
import { DangerButton, SecondaryButton } from './ui';

/**
 * A round toggle collapses/expands the sidebar — same mechanism on
 * every screen size (desktop and mobile), not just below a breakpoint.
 * Collapsed, it shrinks to an icon-only rail (every nav item still visible
 * as its icon) rather than disappearing entirely; clicking any icon expands
 * the full sidebar instead of navigating straight away, so the admin can
 * see the labels before picking one.
 *
 * The toggle + "Admin console" label sit in a fixed-width column at the
 * left of the top bar, matching the sidebar's own width below it; the
 * dealer name/tagline fill the rest of the top bar and resize as that
 * column opens/collapses, since both live in one component with one `open`
 * state instead of being laid out independently.
 */
export function AdminShell({
  businessName,
  tagline,
  address,
  adminName,
  adminEmail,
  signOutAction,
  children,
}: {
  businessName: string;
  tagline: string | null;
  address: string | null;
  adminName: string;
  adminEmail: string | null;
  signOutAction: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const signOutDialog = useRef<HTMLDialogElement>(null);
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
      <div className="no-print sticky top-0 z-20 flex flex-col border-b border-border bg-surface md:h-[65px] md:flex-row md:items-stretch">
        <div
          className={`relative flex shrink-0 items-center gap-3 px-4 py-3 transition-[width] md:border-r md:border-border ${railWidth} ${open ? '' : 'md:px-2'}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-text-on-primary">
            <Icon>
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9v11h14V9" />
              <path d="M10 20v-6h4v6" />
            </Icon>
          </span>
          {open ? (
            <p className="whitespace-nowrap text-base font-semibold text-text">Admin console</p>
          ) : null}
          {/* Sits on the menu's right edge, half over the page. */}
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-text-on-primary shadow-md transition hover:bg-primary-hover md:absolute md:-right-3.5 md:top-1/2 md:-translate-y-1/2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {open ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
            </svg>
          </button>
        </div>
        {/*
          Centered independently of the rail's width via absolute
          positioning on md+, so it stays put in the middle of the bar
          instead of drifting as the sidebar opens/collapses.
        */}
        <div className="flex justify-center px-4 py-3 md:absolute md:inset-y-0 md:left-1/2 md:-translate-x-1/2 md:px-0 md:py-0">
          <div className="flex items-center">
            <AdminHeaderContent businessName={businessName} tagline={tagline} address={address} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        {/* Pinned below the 65px top bar (64px logo + border) while the page
            scrolls. On a short screen only the links scroll (admin-nav.tsx):
            the theme switch and sign-out always stay in view. */}
        <aside
          className={`no-print flex w-full shrink-0 flex-col overflow-x-hidden border-b border-border bg-surface py-4 transition-[width] short:py-3 md:sticky md:top-[65px] md:z-10 md:h-[calc(100dvh-65px)] md:overflow-hidden md:border-b-0 md:border-r ${railWidth} ${
            open ? 'px-4' : 'px-2'
          }`}
        >
          <AdminNav collapsed={!open} onExpand={() => setOpen(true)} />

          <div className="flex shrink-0 flex-col pb-4 pt-4 short:py-2">
            <ThemeToggle collapsed={!open} />
          </div>
          <div className={`flex shrink-0 items-center gap-2 border-t border-border pt-4 short:pt-2 ${open ? '' : 'flex-col'}`}>
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
            <button
              type="button"
              onClick={() => signOutDialog.current?.showModal()}
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
            <dialog
              ref={signOutDialog}
              className="m-auto w-[min(24rem,90vw)] rounded-lg border border-border bg-surface p-5 text-text shadow-lg backdrop:bg-black/40"
            >
              <h2 className="text-lg font-semibold">Sign out?</h2>
              <p className="mt-2 text-sm text-text-secondary">
                You will need to sign in again to use the admin pages.
              </p>
              <form action={signOutAction} className="mt-4 flex justify-end gap-2">
                <SecondaryButton type="button" onClick={() => signOutDialog.current?.close()}>
                  Cancel
                </SecondaryButton>
                <DangerButton type="submit">Sign out</DangerButton>
              </form>
            </dialog>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto bg-surface-muted p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}

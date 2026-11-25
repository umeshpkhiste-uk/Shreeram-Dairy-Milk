'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { LoadingState } from '@/components/ui';
import { getProfile } from '@/lib/db/db';
import { useLive } from '@/lib/db/use-live';
import { isActiveWorker } from '@/lib/is-active-worker';
import { useIsOnline } from '@/lib/sync/connectivity';
import { initSyncEngine, useSyncStatus } from '@/lib/sync/sync-engine';

const TABS = [
  { href: '/today', label: 'Today' },
  { href: '/orders', label: 'Orders' },
  { href: '/history', label: 'History' },
  { href: '/sync', label: 'Sync' },
  { href: '/profile', label: 'Profile' },
];

/**
 * The client-side guard. It trusts the profile stored on
 * the phone at sign-in, so the app opens with no network; every sync refreshes
 * that profile, and RLS is still the actual security boundary.
 */
export default function WorkerLayout({ children }: LayoutProps<'/'>) {
  const pathname = usePathname();
  const isOnline = useIsOnline();
  const sync = useSyncStatus();
  const profile = useLive(getProfile, []);

  const allowed = !!profile && isActiveWorker(profile);
  const loginUrl =
    profile && !isActiveWorker(profile)
      ? '/login?error=not-authorized'
      : profile === null || sync.phase === 'signedOut'
        ? '/login'
        : null;

  useEffect(() => {
    if (allowed) initSyncEngine();
  }, [allowed]);

  useEffect(() => {
    if (loginUrl && isOnline) window.location.replace(loginUrl);
  }, [loginUrl, isOnline]);

  if (!allowed) {
    return (
      <LoadingState
        label={loginUrl && !isOnline ? 'Connect to the internet to sign in.' : 'Checking your session…'}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      {!isOnline ? (
        <p role="status" className="bg-warning-bg px-4 py-2 text-center text-sm text-text">
          Offline
          {sync.pendingCount > 0 ? ` — ${sync.pendingCount} waiting to sync` : ''}
        </p>
      ) : null}
      <main className="flex flex-1 flex-col gap-3 p-4 pb-24">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-surface">
        <ul className="mx-auto flex max-w-xl">
          {TABS.map((tab) => {
            const current = pathname.startsWith(tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <a
                  href={tab.href}
                  aria-current={current ? 'page' : undefined}
                  className={`flex min-h-14 items-center justify-center px-1 text-center text-sm ${current ? 'font-semibold text-primary' : 'text-text-secondary'}`}
                >
                  {tab.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

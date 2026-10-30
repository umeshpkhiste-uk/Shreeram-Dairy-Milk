'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  Dashboard: (
    <Icon>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </Icon>
  ),
  'New Order': (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </Icon>
  ),
  Customers: (
    <Icon>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 20c0-2.6-1.8-4.8-4.2-5.5" />
    </Icon>
  ),
  'Workers & Routes': (
    <Icon>
      <path d="M3 17h11V7H3v10z" />
      <path d="M14 10h4l3 3v4h-7v-7z" />
      <circle cx="7.5" cy="19" r="1.5" />
      <circle cx="17.5" cy="19" r="1.5" />
    </Icon>
  ),
  Deliveries: (
    <Icon>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <line x1="12" y1="13" x2="12" y2="21" />
    </Icon>
  ),
  Billing: (
    <Icon>
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
      <line x1="8.5" y1="7" x2="15.5" y2="7" />
      <line x1="8.5" y1="11" x2="15.5" y2="11" />
    </Icon>
  ),
  Payments: (
    <Icon>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </Icon>
  ),
  Reports: (
    <Icon>
      <line x1="5" y1="20" x2="5" y2="11" />
      <line x1="12" y1="20" x2="12" y2="5" />
      <line x1="19" y1="20" x2="19" y2="14" />
    </Icon>
  ),
  Settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  ),
};

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders', label: 'New Order' },
  { href: '/customers', label: 'Customers' },
  { href: '/workers', label: 'Workers & Routes' },
  { href: '/deliveries', label: 'Deliveries' },
  { href: '/billing', label: 'Billing' },
  { href: '/payments', label: 'Payments' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
] as const;

/**
 * Collapsed (icon rail): each item is a button, not a link — clicking it
 * just expands the sidebar (per owner request, so the admin can see labels
 * before navigating), it never navigates straight from the collapsed state.
 */
export function AdminNav({
  collapsed = false,
  onExpand,
  onNavigate,
}: {
  collapsed?: boolean;
  onExpand?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        const className = `flex items-center gap-3 rounded-md py-2 text-sm font-medium transition ${
          collapsed ? 'justify-center px-2' : 'px-3'
        } ${active ? 'bg-primary-muted text-primary' : 'text-text-secondary hover:bg-surface-muted'}`;

        if (collapsed) {
          return (
            <button
              key={link.href}
              type="button"
              title={link.label}
              aria-label={link.label}
              onClick={onExpand}
              className={className}
            >
              {ICONS[link.label]}
            </button>
          );
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={className}
          >
            {ICONS[link.label]}
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

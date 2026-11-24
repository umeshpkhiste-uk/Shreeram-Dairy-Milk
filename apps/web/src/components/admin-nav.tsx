'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { Icon } from './icon';

const SearchIcon = (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Icon>
);

const ICONS: Record<string, ReactNode> = {
  Inbox: (
    <Icon>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" />
    </Icon>
  ),
  Notifications: (
    <Icon>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Icon>
  ),
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

type Counts = { inbox: number; notifications: number };
type NavLink = { href: string; label: string; count?: keyof Counts };

const SECTIONS: { heading?: string; links: NavLink[] }[] = [
  {
    links: [
      { href: '/inbox', label: 'Inbox', count: 'inbox' },
      { href: '/notifications', label: 'Notifications', count: 'notifications' },
    ],
  },
  {
    heading: 'Menu',
    links: [
      { href: '/', label: 'Dashboard' },
      { href: '/orders', label: 'New Order' },
      { href: '/customers', label: 'Customers' },
      { href: '/workers', label: 'Workers & Routes' },
      { href: '/deliveries', label: 'Deliveries' },
      { href: '/billing', label: 'Billing' },
      { href: '/payments', label: 'Payments' },
      { href: '/reports', label: 'Reports' },
    ],
  },
  { links: [{ href: '/settings', label: 'Settings' }] },
];

const ROW_CLASSES =
  'group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150';

/** Re-read on every navigation, so finishing something drops its badge. */
function useCounts(pathname: string): Counts | null {
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/attention')
      .then((response) => response.json())
      .then(
        (result: Counts) => {
          if (!cancelled) setCounts(result);
        },
        () => {
          // Signed out or offline: show no badge rather than a wrong one.
          if (!cancelled) setCounts(null);
        },
      );
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  return counts;
}

/**
 * Collapsed (icon rail): each item is a button, not a link — clicking it
 * just expands the sidebar (per owner request, so the admin can see labels
 * before navigating), it never navigates straight from the collapsed state.
 */
export function AdminNav({ collapsed, onExpand }: { collapsed: boolean; onExpand: () => void }) {
  const pathname = usePathname();
  const counts = useCounts(pathname);
  const [search, setSearch] = useState('');
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);

  const term = search.trim().toLowerCase();
  const sections = SECTIONS.map((section) => ({
    ...section,
    links: section.links.filter((link) => link.label.toLowerCase().includes(term)),
  })).filter((section) => section.links.length > 0);

  // Positioned against the window, so the rail's own scrolling can't clip it.
  function showTooltip(label: string, element: HTMLElement) {
    const box = element.getBoundingClientRect();
    setTooltip({ label, top: box.top + box.height / 2, left: box.right + 12 });
  }

  function expand() {
    setTooltip(null);
    onExpand();
  }

  function railButton(label: string, icon: ReactNode, className: string, extra?: ReactNode) {
    return (
      <button
        key={label}
        type="button"
        aria-label={label}
        onClick={expand}
        onMouseEnter={(e) => showTooltip(label, e.currentTarget)}
        onMouseLeave={() => setTooltip(null)}
        onFocus={(e) => showTooltip(label, e.currentTarget)}
        onBlur={() => setTooltip(null)}
        className={`${ROW_CLASSES} justify-center py-2 short:py-1.5 shorter:py-1 ${className}`}
      >
        {extra}
        {icon}
      </button>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 short:gap-2">
      {collapsed ? (
        railButton('Search', SearchIcon, 'bg-surface-muted text-text-secondary hover:text-text')
      ) : (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
            {SearchIcon}
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            aria-label="Search menu"
            className="w-full rounded-lg bg-surface-muted py-2 pl-10 pr-3 text-sm text-text outline-none placeholder:text-text-secondary focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      )}

      <nav
        aria-label="Admin"
        className={`flex min-h-0 flex-col gap-3 overflow-x-hidden short:gap-2 md:overflow-y-auto ${
          collapsed ? '-mx-2 px-2 [scrollbar-width:none]' : '-mx-4 px-4 [scrollbar-width:thin]'
        }`}
      >
        {sections.map((section) => (
          <div
            key={section.links[0].href}
            className="flex flex-col gap-1 border-t border-border pt-3 short:gap-0 short:pt-2"
          >
            {section.heading && !collapsed ? (
              <p className="px-3 pb-1 text-xs font-medium text-text-secondary">{section.heading}</p>
            ) : null}
            {section.links.map((link) => {
              const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              const count = (link.count && counts?.[link.count]) || 0;
              const tone = active
                ? 'bg-primary-muted text-primary'
                : 'text-text-secondary hover:bg-border/60 hover:text-text';
              const marker = (
                <span
                  aria-hidden="true"
                  className={`absolute top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-danger transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${
                    collapsed ? '-left-2' : '-left-4'
                  } ${active ? 'opacity-100' : 'opacity-0'}`}
                />
              );

              if (collapsed) {
                return railButton(
                  count > 0 ? `${link.label} (${count})` : link.label,
                  ICONS[link.label],
                  tone,
                  <>
                    {marker}
                    {count > 0 ? (
                      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
                    ) : null}
                  </>,
                );
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`${ROW_CLASSES} gap-3 px-3 py-2 short:py-1.5 shorter:py-1 ${tone}`}
                >
                  {marker}
                  {ICONS[link.label]}
                  <span className="flex-1 whitespace-nowrap">{link.label}</span>
                  {count > 0 ? (
                    <span className="rounded-md bg-danger px-1.5 py-0.5 text-xs font-medium tabular-nums text-text-on-primary">
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {collapsed && tooltip ? (
        <span
          role="tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
          className="pointer-events-none fixed z-30 -translate-y-1/2 whitespace-nowrap rounded-md bg-text px-2.5 py-1.5 text-xs font-medium text-surface shadow-md"
        >
          {tooltip.label}
        </span>
      ) : null}
    </div>
  );
}

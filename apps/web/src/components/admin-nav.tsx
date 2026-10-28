'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/customers', label: 'Customers' },
  { href: '/workers', label: 'Workers & Routes' },
  { href: '/deliveries', label: 'Deliveries' },
  { href: '/billing', label: 'Billing' },
  { href: '/payments', label: 'Payments' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              active ? 'bg-primary-muted text-primary' : 'text-text-secondary hover:bg-surface-muted'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

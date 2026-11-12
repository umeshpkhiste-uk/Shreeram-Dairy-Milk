'use client';

import type { ButtonHTMLAttributes } from 'react';

import { useClickGuard } from '@/lib/use-click-guard';

/**
 * Split out of ui.tsx: these need the click-guard hook, which requires a
 * Client Component boundary. Keeping them in ui.tsx would have made every
 * other export there (Card, Badge, PageHeader, ...) a client component too
 * — those are pure presentational JSX with no hooks, used on nearly every
 * admin page, so that pulled unnecessary client JS into every page's
 * bundle. Still imported as `@/components/ui` everywhere (see ui.tsx).
 */

export function PrimaryButton({
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const guardedOnClick = useClickGuard(onClick);
  return (
    <button
      {...props}
      onClick={guardedOnClick}
      className={`w-fit shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-hover disabled:opacity-60 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const guardedOnClick = useClickGuard(onClick);
  return (
    <button
      {...props}
      onClick={guardedOnClick}
      className={`w-fit shrink-0 rounded-md border border-border px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-muted disabled:opacity-60 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const guardedOnClick = useClickGuard(onClick);
  return (
    <button
      {...props}
      onClick={guardedOnClick}
      className={`w-fit shrink-0 rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

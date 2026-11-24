'use client';

import type { ButtonHTMLAttributes } from 'react';

import { useClickGuard } from '@/lib/use-click-guard';

import { buttonClass, type ButtonTone } from './button-styles';

/**
 * Split out of ui.tsx: these need the click-guard hook, which requires a
 * Client Component boundary. Keeping them in ui.tsx would have made every
 * other export there (Card, Badge, PageHeader, ...) a client component too
 * — those are pure presentational JSX with no hooks, used on nearly every
 * admin page, so that pulled unnecessary client JS into every page's
 * bundle. Still imported as `@/components/ui` everywhere (see ui.tsx).
 */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

function ToneButton({ tone, onClick, className = '', ...props }: ButtonProps & { tone: ButtonTone }) {
  const guardedOnClick = useClickGuard(onClick);
  return (
    <button {...props} onClick={guardedOnClick} className={`${buttonClass(tone)} ${className}`} />
  );
}

export function PrimaryButton(props: ButtonProps) {
  return <ToneButton tone="primary" {...props} />;
}

export function SecondaryButton(props: ButtonProps) {
  return <ToneButton tone="secondary" {...props} />;
}

export function InfoButton(props: ButtonProps) {
  return <ToneButton tone="info" {...props} />;
}

export function WarningButton(props: ButtonProps) {
  return <ToneButton tone="warning" {...props} />;
}

export function DangerButton(props: ButtonProps) {
  return <ToneButton tone="danger" {...props} />;
}

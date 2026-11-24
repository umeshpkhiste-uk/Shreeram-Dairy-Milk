'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import type { DeliveryStatus, StatusTone } from '@shreeram/shared';

import { useClickGuard } from '@/lib/use-click-guard';

/** Small presentational primitives, adapted from apps/web's components/ui.tsx with 48px touch targets. */

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  completed: 'Delivered',
  partial: 'Partial',
  missed: 'Missed',
  skipped: 'No delivery — customer informed',
};

export const DELIVERY_STATUS_TONE: Record<DeliveryStatus, StatusTone> = {
  completed: 'success',
  partial: 'warning',
  missed: 'danger',
  skipped: 'warning',
};

export const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-surface-muted text-text-secondary',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
};

const BUTTON_CLASSES = {
  primary: 'bg-primary text-text-on-primary hover:bg-primary-hover',
  info: 'bg-info text-text-on-primary hover:opacity-90',
  danger: 'bg-danger text-text-on-primary hover:opacity-90',
  secondary: 'border border-border text-text hover:bg-surface-muted',
};

export function Button({
  variant = 'primary',
  onClick,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_CLASSES }) {
  const guardedOnClick = useClickGuard(onClick);
  return (
    <button
      type="button"
      {...props}
      onClick={guardedOnClick}
      className={`min-h-12 min-w-12 rounded-md px-4 text-base font-semibold disabled:opacity-60 ${BUTTON_CLASSES[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>{children}</div>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-semibold text-text">{children}</h1>;
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <span className="text-right text-base">{value}</span>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="font-medium text-text">{title}</p>
      {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <p role="status" className="py-12 text-center text-text-secondary">
      {label}
    </p>
  );
}

export function ErrorText({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

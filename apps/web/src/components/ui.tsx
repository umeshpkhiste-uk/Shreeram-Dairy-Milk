import type { ButtonHTMLAttributes, ReactNode } from 'react';

import type { StatusTone } from '@shreeram/shared';

/** Small, shared presentational primitives — kept deliberately minimal (see docs/web-admin.md). */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-surface p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-surface-muted text-text-secondary',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm font-medium text-text">{title}</p>
      {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
    </div>
  );
}

export function ErrorText({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-hover disabled:opacity-60 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md border border-border px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-muted disabled:opacity-60 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';

import { todayInBusinessTimezone } from '@shreeram/shared';

export function DashboardDatePicker({ date }: { date: string }) {
  const router = useRouter();
  const today = todayInBusinessTimezone();

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => {
          if (e.target.value) router.push(`/?date=${e.target.value}`);
        }}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
      />
      {date !== today ? (
        <button
          type="button"
          onClick={() => router.push('/')}
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-text transition hover:bg-surface-muted"
        >
          Today
        </button>
      ) : null}
    </div>
  );
}

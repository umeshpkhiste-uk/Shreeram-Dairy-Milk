'use client';

import { useEffect, useState } from 'react';

import { todayInBusinessTimezone } from '@shreeram/shared';

/**
 * Today's business date, re-read when the app returns to the foreground — an
 * installed app left open overnight must not mark today's milk against
 * yesterday. `null` while prerendering, so the build date is never baked in.
 */
export function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setToday(todayInBusinessTimezone());
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return today;
}

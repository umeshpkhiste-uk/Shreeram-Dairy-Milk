'use client';

import { liveQuery } from 'dexie';
import { useEffect, useState, type DependencyList } from 'react';

/** Re-runs `query` whenever the IndexedDB rows it read change (any tab). `undefined` until first result. */
export function useLive<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (error) => console.error('Local database query failed', error),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies the deps, like useEffect
  }, deps);
  return value;
}

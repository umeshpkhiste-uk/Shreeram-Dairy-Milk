'use client';

import { useCallback, useRef } from 'react';

/**
 * A double click landing before React re-renders a `disabled`/`pending`
 * prop can fire the same handler twice — including submitting a
 * `<form action={...}>` a second time before the first request has even
 * started, since several forms in this app (e.g. "Create bill",
 * "Finalize bill") are plain server-rendered forms with no client-side
 * pending state at all. A ref-based lock closes that window: `preventDefault`
 * on the repeat click blocks the handler AND the native form submission it
 * would otherwise trigger, with no dependency on a state update landing in
 * time.
 */
const DEFAULT_COOLDOWN_MS = 600;

export function useClickGuard<E extends { preventDefault(): void }>(
  onClick?: (event: E) => void,
  cooldownMs = DEFAULT_COOLDOWN_MS,
): (event: E) => void {
  const lockedUntilRef = useRef(0);

  return useCallback(
    (event: E) => {
      const now = Date.now();
      if (now < lockedUntilRef.current) {
        event.preventDefault();
        return;
      }
      lockedUntilRef.current = now + cooldownMs;
      onClick?.(event);
    },
    [onClick, cooldownMs],
  );
}

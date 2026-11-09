import { useCallback, useRef } from 'react';

/**
 * A double-tap landing before React re-renders a `disabled`/`loading` prop
 * can fire the same handler twice — e.g. a worker tapping "Delivered" twice
 * in quick succession ran `recordDelivery` (synchronous SQLite write) twice
 * before `setSaving(true)` ever took effect. A ref-based lock closes that
 * window: it blocks the repeat tap immediately, with no dependency on a
 * state update landing in time.
 */
const DEFAULT_COOLDOWN_MS = 600;

export function usePressGuard<Args extends unknown[]>(
  onPress: ((...args: Args) => void) | null | undefined,
  cooldownMs = DEFAULT_COOLDOWN_MS,
): (...args: Args) => void {
  const lockedUntilRef = useRef(0);

  return useCallback(
    (...args: Args) => {
      const now = Date.now();
      if (now < lockedUntilRef.current) return;
      lockedUntilRef.current = now + cooldownMs;
      onPress?.(...args);
    },
    [onPress, cooldownMs],
  );
}

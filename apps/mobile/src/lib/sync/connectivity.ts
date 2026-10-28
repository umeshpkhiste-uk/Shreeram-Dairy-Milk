import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function isOnlineState(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean {
  // Treat "unknown" (null) reachability as online — don't block sync on a
  // platform that can't determine it; a genuinely offline device will still
  // fail the upload itself and fall back to backoff.
  return !!state.isConnected && state.isInternetReachable !== false;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(isOnlineState(state));
    });
    NetInfo.fetch().then((state) => setOnline(isOnlineState(state)));
    return unsubscribe;
  }, []);

  return online;
}

export function onConnectivityRestored(callback: () => void): () => void {
  let wasOffline = false;
  return NetInfo.addEventListener((state) => {
    const online = isOnlineState(state);
    if (online && wasOffline) callback();
    wasOffline = !online;
  });
}

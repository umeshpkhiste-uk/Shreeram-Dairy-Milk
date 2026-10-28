import { OfflineBanner } from '@/components/offline-banner';
import { useIsOnline } from '@/lib/sync/connectivity';
import { useSyncStatus } from '@/lib/sync/sync-engine';
import { TodayRouteScreen } from '@/screens/worker/today-route';

export default function WorkerTodayScreen() {
  const isOnline = useIsOnline();
  const sync = useSyncStatus();

  return (
    <>
      <OfflineBanner isOffline={!isOnline} pendingCount={sync.pendingCount} />
      <TodayRouteScreen />
    </>
  );
}

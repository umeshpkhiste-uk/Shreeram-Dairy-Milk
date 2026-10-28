import { OfflineBanner } from '@/components/offline-banner';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function WorkerTodayScreen() {
  return (
    <>
      <OfflineBanner isOffline={false} pendingCount={0} />
      <PlaceholderScreen
        title="Today's Route"
        description="Assigned customers with expected quantity, large delivery-confirmation controls, and offline saving."
        comingInStage="Built in Stage 3 (offline delivery recording and synchronization) — the highest-priority feature."
      />
    </>
  );
}

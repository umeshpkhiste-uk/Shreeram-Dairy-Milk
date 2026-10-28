import { OfflineBanner } from '@/components/offline-banner';
import { useIsOnline } from '@/lib/sync/connectivity';
import { useSyncStatus } from '@/lib/sync/sync-engine';
import { CustomerDeliveryCalendarScreen } from '@/screens/worker/customer-delivery-calendar';

export default function WorkerCustomerCalendarScreen() {
  const isOnline = useIsOnline();
  const sync = useSyncStatus();

  return (
    <>
      <OfflineBanner isOffline={!isOnline} pendingCount={sync.pendingCount} />
      <CustomerDeliveryCalendarScreen />
    </>
  );
}

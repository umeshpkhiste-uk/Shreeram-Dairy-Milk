import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function WorkerSyncScreen() {
  return (
    <PlaceholderScreen
      title="Sync Status"
      description="Pending, failed, and completed synchronization operations, with manual retry."
      comingInStage="Built in Stage 3 (offline delivery recording and synchronization)."
    />
  );
}

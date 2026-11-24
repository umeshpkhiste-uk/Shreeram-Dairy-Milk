'use client';

import { useState } from 'react';

import { Button, Card, ErrorText, LoadingState, Title } from '@/components/ui';
import { clearAllLocalData } from '@/lib/db/clear-local-data';
import { getProfile } from '@/lib/db/db';
import { countFailedOutboxItems, countPendingOutboxItems } from '@/lib/db/outbox-repo';
import { useLive } from '@/lib/db/use-live';
import { supabase } from '@/lib/supabase/client';
import { SYNC_LOCK } from '@/lib/sync/sync-engine';
import { useIsOnline } from '@/lib/sync/connectivity';

export default function ProfilePage() {
  const profile = useLive(getProfile, []);
  const isOnline = useIsOnline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return <LoadingState label="Loading profile…" />;

  async function handleSignOut() {
    setBusy(true);
    setError(null);
    // Waits for a running sync: it may be uploading the very records counted
    // below, and its pull must not refill the tables after they're cleared.
    await navigator.locks.request(SYNC_LOCK, async () => {
      const unsynced = (await countPendingOutboxItems()) + (await countFailedOutboxItems());
      if (
        unsynced > 0 &&
        !window.confirm(
          `You have ${unsynced} delivery record${unsynced === 1 ? '' : 's'} not yet synced to the server. ` +
            'Signing out now will discard them from this device — they will not be recorded. ' +
            'Connect to the internet and wait for sync to finish first if possible.',
        )
      ) {
        return;
      }
      // Supabase keeps the session if it can't reach the server, so nothing
      // may be discarded until it has really ended.
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(`Could not sign out: ${signOutError.message}`);
        return;
      }
      await clearAllLocalData();
      window.location.replace('/login');
    });
    setBusy(false);
  }

  return (
    <>
      <Title>Profile</Title>
      <Card className="flex flex-col gap-1">
        <span className="text-lg font-semibold">{profile.full_name}</span>
        {profile.phone ? <span className="text-text-secondary">{profile.phone}</span> : null}
      </Card>
      {error ? <ErrorText message={error} /> : null}
      <Button variant="secondary" onClick={handleSignOut} disabled={busy || !isOnline}>
        {busy ? 'Signing out…' : 'Sign out'}
      </Button>
      {!isOnline ? (
        <p className="text-sm text-text-secondary">Connect to the internet to sign out.</p>
      ) : null}
    </>
  );
}

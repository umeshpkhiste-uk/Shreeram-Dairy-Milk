'use client';

import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';

import { Button, ErrorText } from '@/components/ui';
import { clearAllLocalData } from '@/lib/db/clear-local-data';
import { getProfile, setProfile } from '@/lib/db/db';
import { countFailedOutboxItems, countPendingOutboxItems } from '@/lib/db/outbox-repo';
import { supabase } from '@/lib/supabase/client';

import { signIn } from './actions';

const INPUT_CLASSES =
  'min-h-12 rounded-md border border-border bg-surface px-3 text-base text-text outline-none focus:border-primary';

/**
 * A session can end without a sign-out (expired, revoked), leaving the last
 * worker's queue on the phone. The same worker just continues; a different one
 * may only take the phone over after agreeing to discard what never synced.
 */
async function submit(_previous: string | null, formData: FormData): Promise<string | null> {
  let result;
  try {
    result = await signIn(
      String(formData.get('email') ?? '').trim(),
      String(formData.get('password') ?? ''),
    );
  } catch {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if ('error' in result) return result.error;

  const previous = await getProfile();
  if (previous && previous.id !== result.profile.id) {
    const unsynced = (await countPendingOutboxItems()) + (await countFailedOutboxItems());
    const discard =
      unsynced === 0 ||
      window.confirm(
        `This phone holds ${unsynced} delivery record${unsynced === 1 ? '' : 's'} from ` +
          `${previous.full_name} not yet synced to the server. Signing in will discard them.`,
      );
    if (!discard) {
      await supabase.auth.signOut({ scope: 'local' });
      return `${previous.full_name} needs to sign in on this phone and sync first.`;
    }
    await clearAllLocalData();
  }
  await setProfile(result.profile);
  window.location.replace('/today');
  return null;
}

export function LoginForm() {
  const notAuthorized = useSearchParams().get('error') === 'not-authorized';
  const [error, formAction, pending] = useActionState(
    submit,
    notAuthorized ? 'That account no longer has worker access.' : null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Email
        <input type="email" name="email" required autoComplete="email" className={INPUT_CLASSES} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className={INPUT_CLASSES}
        />
      </label>
      {error ? <ErrorText message={error} /> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

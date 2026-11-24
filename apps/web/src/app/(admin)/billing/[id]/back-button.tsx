'use client';

import { useRouter } from 'next/navigation';

import { SecondaryButton } from '@/components/ui';

/** Goes back to wherever the admin came from (billing list, a customer's bill
 * history, or their delivery calendar) rather than a single hardcoded route.
 * `fallbackHref` is for pages that can open in a new tab, which has no history. */
export function BackButton({ fallbackHref }: { fallbackHref?: string }) {
  const router = useRouter();
  return (
    <SecondaryButton
      type="button"
      onClick={() =>
        fallbackHref && window.history.length === 1 ? router.push(fallbackHref) : router.back()
      }
    >
      ← Back
    </SecondaryButton>
  );
}

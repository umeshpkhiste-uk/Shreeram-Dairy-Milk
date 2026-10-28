'use client';

import { useRouter } from 'next/navigation';

import { SecondaryButton } from '@/components/ui';

/** Goes back to wherever the admin came from (billing list, a customer's bill
 * history, or their delivery calendar) rather than a single hardcoded route. */
export function BackButton() {
  const router = useRouter();
  return (
    <SecondaryButton type="button" onClick={() => router.back()}>
      ← Back
    </SecondaryButton>
  );
}

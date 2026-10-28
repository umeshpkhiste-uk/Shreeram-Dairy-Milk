'use client';

import { PrimaryButton } from '@/components/ui';

export function PrintButton() {
  return <PrimaryButton onClick={() => window.print()}>Print / Save as PDF</PrimaryButton>;
}

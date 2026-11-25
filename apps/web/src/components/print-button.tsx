'use client';

import { InfoButton } from '@/components/ui';

export function PrintButton() {
  return <InfoButton onClick={() => window.print()}>Print / Save as PDF</InfoButton>;
}

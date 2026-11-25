import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BILL_STYLE, billAmountDue, renderBillBodyHtml } from '@shreeram/shared';

import { PrintButton } from '@/components/print-button';
import { Card } from '@/components/ui';
import { getBillDocument } from '@/lib/data/bills';
import { createClient } from '@/lib/supabase/server';

import { claimPaymentAction } from './actions';
import { ClaimForm } from './claim-form';
import { CloseButton } from './close-button';

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: 'Bill — Shreeram Doodh Dairy & Sweets',
  description: 'Your bill from Shreeram Doodh Dairy & Sweets.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** The customer's bill, opened from the WhatsApp link without signing in (see src/proxy.ts). */
export default async function PublicBillPage({ params }: PageProps) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  const data = await getBillDocument(await createClient(), id);
  if (!data) notFound();
  const { duePaise } = billAmountDue(
    data.bill.status,
    data.bill.totalPayablePaise,
    data.payments.reduce((sum, p) => sum + p.amountPaise, 0),
  );

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <style dangerouslySetInnerHTML={{ __html: BILL_STYLE }} />
      <div className="no-print mb-4 flex items-start justify-between gap-3">
        <CloseButton />
        <PrintButton />
      </div>
      <div
        className="overflow-x-auto rounded-lg border border-border bg-white p-4 sm:p-8"
        // Content is built entirely from this app's own escaping renderer
        // (packages/shared/src/lib/pdf/bill-template.ts).
        dangerouslySetInnerHTML={{ __html: renderBillBodyHtml(data) }}
      />
      {duePaise > 0 ? (
        <Card className="no-print mt-4">
          {data.paymentClaimed ? (
            <p role="status" className="text-sm text-text">
              Thank you. We have your payment details and will check them soon.
            </p>
          ) : (
            <ClaimForm action={claimPaymentAction.bind(null, id)} duePaise={duePaise} />
          )}
        </Card>
      ) : null}
    </div>
  );
}

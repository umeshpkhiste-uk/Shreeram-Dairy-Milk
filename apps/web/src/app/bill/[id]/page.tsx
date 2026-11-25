import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BILL_STYLE, renderBillBodyHtml } from '@shreeram/shared';

import { PrintButton } from '@/components/print-button';
import { getBillDocument } from '@/lib/data/bills';
import { createClient } from '@/lib/supabase/server';

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

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <style dangerouslySetInnerHTML={{ __html: BILL_STYLE }} />
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <div
        className="overflow-x-auto rounded-lg border border-border bg-white p-4 sm:p-8"
        // Content is built entirely from this app's own escaping renderer
        // (packages/shared/src/lib/pdf/bill-template.ts).
        dangerouslySetInnerHTML={{ __html: renderBillBodyHtml(data) }}
      />
    </div>
  );
}

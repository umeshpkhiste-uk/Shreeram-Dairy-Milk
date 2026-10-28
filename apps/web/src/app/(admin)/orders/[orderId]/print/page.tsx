import { notFound } from 'next/navigation';

import { ORDER_RECEIPT_STYLE, renderOrderReceiptBodyHtml, type OrderReceiptPdfData } from '@shreeram/shared';

import { getBusinessSettings } from '@/lib/data/business-settings';
import { getOrder } from '@/lib/data/orders';
import { createClient } from '@/lib/supabase/server';

import { PrintButton } from '../../../billing/[id]/print/print-button';

type PageProps = { params: Promise<{ orderId: string }> };

/**
 * Order receipt PDF — "Generate bill" from the order actions panel. Same
 * browser-print mechanism as the monthly bill's PDF (no server-side PDF
 * rendering dependency); see docs/web-admin.md "One-time product orders".
 */
export default async function OrderPrintPage({ params }: PageProps) {
  const { orderId } = await params;
  const supabase = await createClient();

  const [order, business] = await Promise.all([getOrder(supabase, orderId), getBusinessSettings(supabase)]);
  if (!order) notFound();

  const data: OrderReceiptPdfData = {
    business: {
      businessName: business.business_name,
      contactPhone: business.contact_phone,
      contactEmail: business.contact_email,
      address: business.address,
    },
    customerName: order.customerName,
    orderDate: order.order.order_date,
    notes: order.order.notes,
    paymentStatus: order.order.payment_status,
    paymentMethod: order.order.payment_method,
    items: order.items.map((item) => ({
      productName: item.productName,
      unit: item.unit,
      quantity: item.quantity,
      pricePaise: item.pricePaise,
      amountPaise: item.amountPaise,
    })),
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <style dangerouslySetInnerHTML={{ __html: ORDER_RECEIPT_STYLE }} />
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <div
        className="rounded-lg border border-border bg-white p-8"
        // Built entirely from this app's own escaped, trusted renderer
        // (packages/shared/src/lib/pdf/order-receipt-template.ts) from data
        // this admin's own session can already read — not user-supplied markup.
        dangerouslySetInnerHTML={{ __html: renderOrderReceiptBodyHtml(data) }}
      />
    </div>
  );
}

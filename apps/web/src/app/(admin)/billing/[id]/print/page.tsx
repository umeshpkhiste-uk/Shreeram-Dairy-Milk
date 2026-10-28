import { notFound } from 'next/navigation';

import { BILL_STYLE, renderBillBodyHtml, type BillPdfData } from '@shreeram/shared';

import { getBillWithDetails } from '@/lib/data/bills';
import { getBusinessSettings } from '@/lib/data/business-settings';
import { getCustomer } from '@/lib/data/customers';
import { listAllMilkTypes } from '@/lib/data/milk-types';
import { createClient } from '@/lib/supabase/server';

import { PrintButton } from './print-button';

type PageProps = { params: Promise<{ id: string }> };

/**
 * The website's "PDF bill generation" — renders the exact same bill layout
 * as the mobile app's expo-print PDF (packages/shared/src/lib/pdf/bill-template.ts)
 * and lets the admin use the browser's own Print dialog to save it as a PDF
 * or send it to a printer. No server-side PDF rendering dependency needed.
 */
export default async function BillPrintPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const details = await getBillWithDetails(supabase, id);
  if (!details) notFound();
  const { bill, items, adjustments, payments } = details;

  const [customer, milkTypes, business] = await Promise.all([
    getCustomer(supabase, bill.customer_id),
    listAllMilkTypes(supabase),
    getBusinessSettings(supabase),
  ]);
  if (!customer) notFound();
  const milkTypeNameById = new Map(milkTypes.map((m) => [m.id, m.name]));

  const data: BillPdfData = {
    business: {
      businessName: business.business_name,
      contactPhone: business.contact_phone,
      contactEmail: business.contact_email,
      address: business.address,
    },
    customer: {
      fullName: customer.full_name,
      address: customer.address,
      mobileNumber: customer.mobile_number,
      accountReference: customer.account_reference,
    },
    bill: {
      billNumber: bill.bill_number,
      billingMonth: bill.billing_month,
      status: bill.status,
      previousOutstandingBalancePaise: bill.previous_outstanding_balance_paise,
      subtotalPaise: bill.subtotal_paise,
      adjustmentsTotalPaise: bill.adjustments_total_paise,
      totalPayablePaise: bill.total_payable_paise,
    },
    items: items.map((item) => ({
      deliveryDate: item.delivery_date,
      milkTypeName: milkTypeNameById.get(item.milk_type_id) ?? 'Milk',
      quantityMl: item.quantity_ml,
      pricePaise: item.price_paise,
      amountPaise: item.amount_paise,
    })),
    adjustments: adjustments.map((a) => ({ reason: a.reason, amountPaise: a.amount_paise })),
    payments: payments
      .filter((p) => !p.voided_at)
      .map((p) => ({
        paymentDate: p.payment_date,
        amountPaise: p.amount_paise,
        method: p.method,
        transactionReference: p.transaction_reference,
      })),
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <style dangerouslySetInnerHTML={{ __html: BILL_STYLE }} />
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <div
        className="rounded-lg border border-border bg-white p-8"
        // Content is built entirely from this app's own escaped, trusted
        // renderer (packages/shared/src/lib/pdf/bill-template.ts) from data
        // this admin's own session can already read — not user-supplied markup.
        dangerouslySetInnerHTML={{ __html: renderBillBodyHtml(data) }}
      />
    </div>
  );
}

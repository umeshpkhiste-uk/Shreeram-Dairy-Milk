import { toCsv } from '@shreeram/shared';
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { listBillsForMonth } from '@/lib/data/bills';
import { listCustomers } from '@/lib/data/customers';
import { listPaymentsForBillIds } from '@/lib/data/payments';
import { createClient } from '@/lib/supabase/server';

/**
 * A Route Handler (not a Server Component/Action) because this is a file
 * download with its own content type and filename — see the Next.js
 * data-patterns reference. It does NOT inherit `app/(admin)/layout.tsx`'s
 * admin check (route handlers sit outside the page/layout tree), so it
 * calls `requireAdmin()` itself; that call also happens to redirect rather
 * than 403 on failure, which is fine here since this is only ever reached
 * via a link from an already-admin-gated page.
 */
export async function GET(request: NextRequest) {
  await requireAdmin();

  const month = request.nextUrl.searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}-01$/.test(month)) {
    return NextResponse.json({ error: 'Provide a month=YYYY-MM-01 query parameter.' }, { status: 400 });
  }

  const supabase = await createClient();
  const [bills, customers] = await Promise.all([
    listBillsForMonth(supabase, month),
    listCustomers(supabase, { status: 'all' }),
  ]);
  const payments = await listPaymentsForBillIds(supabase, bills.map((b) => b.id));

  const customerNameById = new Map(customers.map((c) => [c.id, c.full_name]));
  const paidByBillId = new Map<string, number>();
  for (const p of payments) {
    paidByBillId.set(p.bill_id, (paidByBillId.get(p.bill_id) ?? 0) + p.amount_paise);
  }

  const rows = bills.map((b) => {
    const paid = paidByBillId.get(b.id) ?? 0;
    return [
      customerNameById.get(b.customer_id) ?? 'Unknown customer',
      b.bill_number,
      (b.total_payable_paise / 100).toFixed(2),
      (paid / 100).toFixed(2),
      ((b.total_payable_paise - paid) / 100).toFixed(2),
    ];
  });

  const csv = toCsv(['Customer', 'Bill Number', 'Billed (₹)', 'Paid (₹)', 'Outstanding (₹)'], rows);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="billing-summary-${month}.csv"`,
    },
  });
}

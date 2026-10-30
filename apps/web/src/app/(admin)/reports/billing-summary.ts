import type { Database } from '@shreeram/shared';

type MonthlyBillRow = Database['public']['Tables']['monthly_bills']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];

export type BillingSummaryRow = {
  billId: string;
  customerName: string;
  billNumber: string;
  billedPaise: number;
  paidPaise: number;
  outstandingPaise: number;
};

/** Shared by the Reports page and its print view, so both show the exact same numbers. */
export function buildBillingSummaryRows(
  bills: MonthlyBillRow[],
  customers: CustomerRow[],
  payments: PaymentRow[],
): BillingSummaryRow[] {
  const customerNameById = new Map(customers.map((c) => [c.id, c.full_name]));
  const paidByBillId = new Map<string, number>();
  for (const p of payments) {
    paidByBillId.set(p.bill_id, (paidByBillId.get(p.bill_id) ?? 0) + p.amount_paise);
  }
  return bills.map((b) => {
    const paid = paidByBillId.get(b.id) ?? 0;
    return {
      billId: b.id,
      customerName: customerNameById.get(b.customer_id) ?? 'Unknown customer',
      billNumber: b.bill_number,
      billedPaise: b.total_payable_paise,
      paidPaise: paid,
      outstandingPaise: b.total_payable_paise - paid,
    };
  });
}

export function sumBillingSummaryTotals(rows: BillingSummaryRow[]) {
  return rows.reduce(
    (acc, r) => ({
      billed: acc.billed + r.billedPaise,
      paid: acc.paid + r.paidPaise,
      outstanding: acc.outstanding + r.outstandingPaise,
    }),
    { billed: 0, paid: 0, outstanding: 0 },
  );
}

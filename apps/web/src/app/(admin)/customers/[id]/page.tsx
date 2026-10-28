import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatPaiseAsRupees } from '@shreeram/shared';

import { Badge, Card, EmptyState, PageHeader, SecondaryButton } from '@/components/ui';
import { listBillsForCustomer } from '@/lib/data/bills';
import { listRatesForCustomer } from '@/lib/data/customer-rates';
import { getCustomer } from '@/lib/data/customers';
import { listAllMilkTypes } from '@/lib/data/milk-types';
import { listWorkers } from '@/lib/data/workers';
import { createClient } from '@/lib/supabase/server';

import { setCustomerStatusAction, updateCustomerAction } from '../actions';
import { CustomerForm } from '../customer-form';
import { setCustomerRateAction } from './actions';
import { RateForm } from './rate-form';

type PageProps = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const customer = await getCustomer(supabase, id);
  if (!customer) notFound();

  const [milkTypes, workers, bills, rates] = await Promise.all([
    listAllMilkTypes(supabase),
    listWorkers(supabase),
    listBillsForCustomer(supabase, id),
    listRatesForCustomer(supabase, id),
  ]);

  const milkTypeById = new Map(milkTypes.map((m) => [m.id, m]));
  const boundUpdate = updateCustomerAction.bind(null, id);
  const boundSetRate = setCustomerRateAction.bind(null, id);
  const nextStatus = customer.status === 'active' ? 'inactive' : 'active';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={customer.full_name}
        description={customer.mobile_number}
        actions={
          <form action={setCustomerStatusAction.bind(null, id, nextStatus)}>
            <SecondaryButton type="submit">
              {customer.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </SecondaryButton>
          </form>
        }
      />

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Badge
            label={customer.status === 'active' ? 'Active' : 'Inactive'}
            tone={customer.status === 'active' ? 'success' : 'neutral'}
          />
        </div>
        <CustomerForm
          customer={customer}
          milkTypes={milkTypes}
          workers={workers}
          action={boundUpdate}
          submitLabel="Save changes"
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Pricing</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Customer-specific, effective-dated rates. Setting a new rate closes the current one and
          never changes the price already recorded on past deliveries or bills.
        </p>
        <RateForm milkTypes={milkTypes} action={boundSetRate} />
        {rates.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-1 text-sm text-text-secondary">
            {rates.map((r) => (
              <li key={r.id}>
                {milkTypeById.get(r.milk_type_id)?.name ?? 'Milk type'}: {formatPaiseAsRupees(r.price_paise)}/L
                from {r.effective_from}
                {r.effective_to ? ` to ${r.effective_to}` : ' (current)'}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Billing history</h2>
        {bills.length === 0 ? (
          <EmptyState title="No bills yet" description="Bills appear here once created from the Billing tab." />
        ) : (
          <ul className="flex flex-col gap-2">
            {bills.map((bill) => (
              <li key={bill.id}>
                <Link href={`/billing/${bill.id}`} className="font-medium text-primary">
                  {bill.bill_number}
                </Link>
                <span className="ml-2 text-sm text-text-secondary">
                  {bill.billing_month} · {formatPaiseAsRupees(bill.total_payable_paise)} · {bill.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

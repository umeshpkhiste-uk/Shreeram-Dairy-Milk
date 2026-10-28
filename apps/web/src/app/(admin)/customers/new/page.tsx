import { Card, PageHeader } from '@/components/ui';
import { listAllMilkTypes } from '@/lib/data/milk-types';
import { listWorkers } from '@/lib/data/workers';
import { createClient } from '@/lib/supabase/server';

import { createCustomerAction } from '../actions';
import { CustomerForm } from '../customer-form';

export default async function NewCustomerPage() {
  const supabase = await createClient();
  const [milkTypes, workers] = await Promise.all([
    listAllMilkTypes(supabase),
    listWorkers(supabase),
  ]);

  return (
    <div>
      <PageHeader title="Add customer" />
      <Card>
        <CustomerForm
          milkTypes={milkTypes}
          workers={workers}
          action={createCustomerAction}
          submitLabel="Create customer"
        />
      </Card>
    </div>
  );
}

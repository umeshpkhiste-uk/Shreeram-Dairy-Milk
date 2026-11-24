import { Suspense } from 'react';

import { CustomerDeliverySummary } from './summary';

export default function CustomerDeliverySummaryPage() {
  return (
    <Suspense>
      <CustomerDeliverySummary />
    </Suspense>
  );
}

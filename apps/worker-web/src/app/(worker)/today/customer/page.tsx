import { Suspense } from 'react';

import { CustomerDeliveryCalendar } from './calendar';

// ?id=… rather than a [customerId] segment, so this stays one static page the
// service worker can precache for every customer (docs/worker-web.md).
export default function CustomerDeliveryCalendarPage() {
  return (
    <Suspense>
      <CustomerDeliveryCalendar />
    </Suspense>
  );
}

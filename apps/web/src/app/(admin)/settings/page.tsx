import { Card, PageHeader } from '@/components/ui';
import { getBusinessSettings } from '@/lib/data/business-settings';
import { listAllProducts } from '@/lib/data/products';
import { createClient } from '@/lib/supabase/server';

import { createOrderItemAction, updateBusinessSettingsAction } from './actions';
import { BusinessSettingsForm } from './business-settings-form';
import { NewOrderItemForm } from './new-order-item-form';
import { OrderItemRow } from './order-item-row';

export default async function SettingsPage() {
  const supabase = await createClient();
  const [settings, products] = await Promise.all([
    getBusinessSettings(supabase),
    listAllProducts(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Business settings</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Shown on every generated bill and visible to any signed-in user.
        </p>
        <BusinessSettingsForm settings={settings} action={updateBusinessSettingsAction} />
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Order items</h2>
        <p className="mb-4 text-sm text-text-secondary">
          The catalog used on the New Order page (paneer, ghee, dahi, milk by the one-off, etc.).
          Update a price here and it applies to every order placed from now on.
        </p>
        <NewOrderItemForm action={createOrderItemAction} />
        {products.length > 0 ? (
          <ul className="mt-4">
            {products.map((p) => (
              <OrderItemRow key={p.id} product={p} />
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}

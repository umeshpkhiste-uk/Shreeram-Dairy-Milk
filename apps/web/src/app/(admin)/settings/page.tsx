import { Card, PageHeader } from '@/components/ui';
import { getBusinessSettings } from '@/lib/data/business-settings';
import { listAllMilkTypes } from '@/lib/data/milk-types';
import { createClient } from '@/lib/supabase/server';

import { createMilkTypeAction, updateBusinessSettingsAction } from './actions';
import { BusinessSettingsForm } from './business-settings-form';
import { MilkTypeRowItem } from './milk-type-row';
import { NewMilkTypeForm } from './new-milk-type-form';

export default async function SettingsPage() {
  const supabase = await createClient();
  const [settings, milkTypes] = await Promise.all([
    getBusinessSettings(supabase),
    listAllMilkTypes(supabase),
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
        <h2 className="mb-3 text-lg font-semibold text-text">Milk types</h2>
        <NewMilkTypeForm action={createMilkTypeAction} />
        {milkTypes.length > 0 ? (
          <ul className="mt-4">
            {milkTypes.map((m) => (
              <MilkTypeRowItem key={m.id} milkType={m} />
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}

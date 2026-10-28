import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChipSelect } from '@/components/chip-select';
import { Input } from '@/components/input';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import type { CachedCustomer } from '@/lib/sqlite/cache-repo';
import type { LocalDelivery } from '@/lib/sqlite/deliveries-repo';
import { QUICK_QUANTITIES_ML } from '@/lib/validation/customer';
import { DELIVERY_STATUS_OPTIONS, deliveryEntrySchema } from '@/lib/validation/delivery';
import { Spacing } from '@/theme/tokens';
import type { DeliveryStatus } from '@/types/database';

export type DeliveryEntryValues = {
  status: DeliveryStatus;
  deliveredQuantityMl: number;
  reason: string | null;
};

export function DeliveryEntrySheet({
  customer,
  existing,
  onCancel,
  onSave,
}: {
  customer: CachedCustomer;
  existing: LocalDelivery | null;
  onCancel: () => void;
  onSave: (values: DeliveryEntryValues) => void;
}) {
  const [status, setStatus] = useState<DeliveryStatus>(existing?.status ?? 'completed');
  const [quantityText, setQuantityText] = useState(
    String(existing?.delivered_quantity_ml ?? customer.default_daily_quantity_ml),
  );
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const parsed = deliveryEntrySchema.safeParse({
      status,
      deliveredQuantityMl: Number(quantityText),
      reason: reason.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the values and try again');
      return;
    }
    setError(null);
    onSave({
      status: parsed.data.status,
      deliveredQuantityMl: parsed.data.deliveredQuantityMl,
      reason: parsed.data.reason ?? null,
    });
  }

  return (
    <Screen scroll>
      <Text variant="title">{customer.full_name}</Text>
      <Text variant="body" color="secondary">
        {customer.address}
      </Text>

      <ChipSelect
        label="Status"
        options={[...DELIVERY_STATUS_OPTIONS]}
        value={status}
        onChange={(value) => value && setStatus(value)}
        scroll={false}
      />

      <ChipSelect
        label="Quick quantity (ml)"
        options={QUICK_QUANTITIES_ML.map((q) => ({ value: String(q), label: `${q} ml` }))}
        value={quantityText}
        onChange={(value) => value && setQuantityText(value)}
      />

      <Input
        label="Delivered quantity (ml)"
        value={quantityText}
        onChangeText={setQuantityText}
        keyboardType="number-pad"
      />

      {status !== 'completed' ? (
        <Input
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. customer not home, spilled, short supply"
        />
      ) : null}

      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button label="Save" onPress={handleSave} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.sm },
});

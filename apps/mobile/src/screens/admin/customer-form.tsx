import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChipSelect } from '@/components/chip-select';
import { Input } from '@/components/input';
import { Text } from '@/components/text';
import { listActiveMilkTypes, type MilkTypeRow } from '@/lib/api/milk-types';
import { listRoutes, listWorkers, type WorkerSummary } from '@/lib/api/workers';
import type { Database } from '@/types/database';
import { customerFormSchema, type CustomerFormValues } from '@/lib/validation/customer';
import { Spacing } from '@/theme/tokens';

type RouteRow = Database['public']['Tables']['routes']['Row'];

type FormState = {
  fullName: string;
  mobileNumber: string;
  email: string;
  address: string;
  locality: string;
  landmark: string;
  assignedWorkerId: string | null;
  routeId: string | null;
  routeSequence: string;
  defaultDailyQuantityMl: string;
  milkTypeId: string | null;
  preferredDeliveryWindow: string;
  deliveryStartDate: string;
  notes: string;
  billingContactName: string;
  billingContactPhone: string;
  accountReference: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function emptyForm(): FormState {
  return {
    fullName: '',
    mobileNumber: '',
    email: '',
    address: '',
    locality: '',
    landmark: '',
    assignedWorkerId: null,
    routeId: null,
    routeSequence: '',
    defaultDailyQuantityMl: '500',
    milkTypeId: null,
    preferredDeliveryWindow: '',
    deliveryStartDate: todayIso(),
    notes: '',
    billingContactName: '',
    billingContactPhone: '',
    accountReference: '',
  };
}

export type CustomerFormProps = {
  initial?: Partial<FormState>;
  submitLabel: string;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
};

export function CustomerForm({ initial, submitLabel, onSubmit }: CustomerFormProps) {
  const [form, setForm] = useState<FormState>({ ...emptyForm(), ...initial });
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [milkTypes, setMilkTypes] = useState<MilkTypeRow[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listWorkers(), listRoutes(), listActiveMilkTypes()])
      .then(([w, r, m]) => {
        if (cancelled) return;
        setWorkers(w);
        setRoutes(r);
        setMilkTypes(m);
        setForm((prev) => (prev.milkTypeId ? prev : { ...prev, milkTypeId: m[0]?.id ?? null }));
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setFormError(null);
    const quantity = Number(form.defaultDailyQuantityMl);
    const parsed = customerFormSchema.safeParse({
      fullName: form.fullName,
      mobileNumber: form.mobileNumber,
      email: form.email,
      address: form.address,
      locality: form.locality,
      landmark: form.landmark,
      assignedWorkerId: form.assignedWorkerId,
      routeId: form.routeId,
      routeSequence: form.routeSequence ? Number(form.routeSequence) : null,
      defaultDailyQuantityMl: Number.isFinite(quantity) ? quantity : NaN,
      milkTypeId: form.milkTypeId ?? '',
      preferredDeliveryWindow: form.preferredDeliveryWindow,
      deliveryStartDate: form.deliveryStartDate,
      notes: form.notes,
      billingContactName: form.billingContactName,
      billingContactPhone: form.billingContactPhone,
      accountReference: form.accountReference,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text variant="subtitle">Customer details</Text>
      <Input
        label="Full name"
        value={form.fullName}
        onChangeText={(v) => setField('fullName', v)}
        error={errors.fullName}
      />
      <Input
        label="Mobile number"
        value={form.mobileNumber}
        onChangeText={(v) => setField('mobileNumber', v)}
        keyboardType="phone-pad"
        error={errors.mobileNumber}
      />
      <Input
        label="Email (optional)"
        value={form.email}
        onChangeText={(v) => setField('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />
      <Input
        label="Address"
        value={form.address}
        onChangeText={(v) => setField('address', v)}
        multiline
        error={errors.address}
      />
      <Input
        label="Locality (optional)"
        value={form.locality}
        onChangeText={(v) => setField('locality', v)}
      />
      <Input
        label="Landmark (optional)"
        value={form.landmark}
        onChangeText={(v) => setField('landmark', v)}
      />

      <Text variant="subtitle">Delivery</Text>
      <ChipSelect
        label="Milk type"
        options={milkTypes.map((m) => ({ value: m.id, label: m.name }))}
        value={form.milkTypeId}
        onChange={(v) => setField('milkTypeId', v)}
      />
      {errors.milkTypeId ? (
        <Text variant="caption" color="danger">
          {errors.milkTypeId}
        </Text>
      ) : null}
      <Input
        label="Default daily quantity (ml)"
        value={form.defaultDailyQuantityMl}
        onChangeText={(v) => setField('defaultDailyQuantityMl', v)}
        keyboardType="number-pad"
        error={errors.defaultDailyQuantityMl}
      />
      <Input
        label="Preferred delivery window (optional)"
        value={form.preferredDeliveryWindow}
        onChangeText={(v) => setField('preferredDeliveryWindow', v)}
        placeholder="e.g. 6:00–7:00 AM"
      />
      <Input
        label="Delivery start date"
        value={form.deliveryStartDate}
        onChangeText={(v) => setField('deliveryStartDate', v)}
        placeholder="YYYY-MM-DD"
        error={errors.deliveryStartDate}
      />

      <Text variant="subtitle">Assignment</Text>
      {loadingOptions ? (
        <Text variant="caption" color="secondary">
          Loading workers and routes…
        </Text>
      ) : (
        <>
          <ChipSelect
            label="Assigned worker"
            options={workers.map((w) => ({ value: w.id, label: w.fullName }))}
            value={form.assignedWorkerId}
            onChange={(v) => setField('assignedWorkerId', v)}
            allowClear
          />
          <ChipSelect
            label="Route"
            options={routes.map((r) => ({ value: r.id, label: r.name }))}
            value={form.routeId}
            onChange={(v) => setField('routeId', v)}
            allowClear
          />
          <Input
            label="Route sequence (optional)"
            value={form.routeSequence}
            onChangeText={(v) => setField('routeSequence', v)}
            keyboardType="number-pad"
            error={errors.routeSequence}
          />
        </>
      )}

      <Text variant="subtitle">Billing (optional)</Text>
      <Input
        label="Billing contact name"
        value={form.billingContactName}
        onChangeText={(v) => setField('billingContactName', v)}
      />
      <Input
        label="Billing contact phone"
        value={form.billingContactPhone}
        onChangeText={(v) => setField('billingContactPhone', v)}
        keyboardType="phone-pad"
        error={errors.billingContactPhone}
      />
      <Input
        label="Account reference"
        value={form.accountReference}
        onChangeText={(v) => setField('accountReference', v)}
      />
      <Input
        label="Notes"
        value={form.notes}
        onChangeText={(v) => setField('notes', v)}
        multiline
      />

      {formError ? (
        <Text variant="body" color="danger">
          {formError}
        </Text>
      ) : null}

      <Button label={submitLabel} onPress={handleSubmit} loading={submitting} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md, paddingBottom: Spacing.xl },
});

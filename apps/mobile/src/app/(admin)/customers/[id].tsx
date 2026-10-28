import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Input } from '@/components/input';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge } from '@/components/status-badge';
import { Text } from '@/components/text';
import { listBillsForCustomer, type MonthlyBillRow } from '@/lib/api/bills';
import {
  listRatesForCustomer,
  setCustomerRate,
  type CustomerMilkRateRow,
} from '@/lib/api/customer-rates';
import {
  getCustomer,
  setCustomerStatus,
  updateCustomer,
  type CustomerRow,
} from '@/lib/api/customers';
import { BILL_STATUS_LABEL, BILL_STATUS_TONE } from '@/lib/billing/status';
import { formatPaiseAsRupees, parseRupeesToPaise } from '@/lib/money';
import { CustomerForm } from '@/screens/admin/customer-form';
import type { CustomerFormValues } from '@/lib/validation/customer';
import { Spacing } from '@/theme/tokens';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getCustomer(id)
      .then(setCustomer)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load customer'));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleUpdate(values: CustomerFormValues) {
    const updated = await updateCustomer(id, values);
    setCustomer(updated);
    setEditing(false);
  }

  async function handleToggleStatus() {
    if (!customer) return;
    const nextStatus = customer.status === 'active' ? 'inactive' : 'active';
    const verb = nextStatus === 'inactive' ? 'Deactivate' : 'Reactivate';
    Alert.alert(`${verb} customer?`, `${customer.full_name} will be marked ${nextStatus}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: verb,
        style: nextStatus === 'inactive' ? 'destructive' : 'default',
        onPress: async () => {
          setStatusUpdating(true);
          try {
            await setCustomerStatus(customer.id, nextStatus);
            setCustomer({ ...customer, status: nextStatus });
          } catch (err) {
            Alert.alert('Failed to update status', err instanceof Error ? err.message : undefined);
          } finally {
            setStatusUpdating(false);
          }
        },
      },
    ]);
  }

  if (error) {
    return (
      <Screen>
        <ErrorState description={error} onRetry={load} />
      </Screen>
    );
  }

  if (!customer) {
    return (
      <Screen>
        <LoadingState label="Loading customer…" />
      </Screen>
    );
  }

  if (editing) {
    return (
      <Screen scroll>
        <CustomerForm
          submitLabel="Save changes"
          onSubmit={handleUpdate}
          initial={{
            fullName: customer.full_name,
            mobileNumber: customer.mobile_number,
            email: customer.email ?? '',
            address: customer.address,
            locality: customer.locality ?? '',
            landmark: customer.landmark ?? '',
            assignedWorkerId: customer.assigned_worker_id,
            routeId: customer.route_id,
            routeSequence: customer.route_sequence ? String(customer.route_sequence) : '',
            defaultDailyQuantityMl: String(customer.default_daily_quantity_ml),
            milkTypeId: customer.milk_type_id,
            preferredDeliveryWindow: customer.preferred_delivery_window ?? '',
            deliveryStartDate: customer.delivery_start_date,
            notes: customer.notes ?? '',
            billingContactName: customer.billing_contact_name ?? '',
            billingContactPhone: customer.billing_contact_phone ?? '',
            accountReference: customer.account_reference ?? '',
          }}
        />
        <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.titleRow}>
        <Text variant="title">{customer.full_name}</Text>
        <StatusBadge
          label={customer.status === 'active' ? 'Active' : 'Inactive'}
          tone={customer.status === 'active' ? 'success' : 'neutral'}
        />
      </View>

      <Card style={styles.card}>
        <Row label="Mobile" value={customer.mobile_number} />
        {customer.email ? <Row label="Email" value={customer.email} /> : null}
        <Row label="Address" value={customer.address} />
        {customer.locality ? <Row label="Locality" value={customer.locality} /> : null}
        <Row label="Daily quantity" value={`${customer.default_daily_quantity_ml} ml`} />
        <Row label="Delivery start" value={customer.delivery_start_date} />
        {customer.preferred_delivery_window ? (
          <Row label="Preferred window" value={customer.preferred_delivery_window} />
        ) : null}
        {customer.notes ? <Row label="Notes" value={customer.notes} /> : null}
      </Card>

      <CustomerPricingSection customerId={customer.id} milkTypeId={customer.milk_type_id} />

      <CustomerBillingSection customerId={customer.id} />

      <View style={styles.actions}>
        <Button label="Edit" onPress={() => setEditing(true)} />
        <Button
          label={customer.status === 'active' ? 'Deactivate' : 'Reactivate'}
          variant={customer.status === 'active' ? 'danger' : 'secondary'}
          onPress={handleToggleStatus}
          loading={statusUpdating}
        />
      </View>
    </Screen>
  );
}

function CustomerPricingSection({
  customerId,
  milkTypeId,
}: {
  customerId: string;
  milkTypeId: string;
}) {
  const [rates, setRates] = useState<CustomerMilkRateRow[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listRatesForCustomer(customerId)
      .then(setRates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load rates'));
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const currentRate = rates?.find((r) => r.effective_to === null && r.milk_type_id === milkTypeId);

  async function handleSave() {
    const paise = parseRupeesToPaise(priceInput);
    if (paise === null) {
      setError('Enter a valid price, e.g. 55 or 55.50');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await setCustomerRate({ customerId, milkTypeId, pricePaise: paise, effectiveFrom });
      setShowForm(false);
      setPriceInput('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rate');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text variant="subtitle">Pricing</Text>
      {currentRate ? (
        <Row
          label="Current rate"
          value={`${formatPaiseAsRupees(currentRate.price_paise)} / litre`}
        />
      ) : (
        <Text variant="body" color="secondary">
          No customer-specific rate set — billed at the milk type&rsquo;s default price.
        </Text>
      )}

      {showForm ? (
        <View style={styles.rateForm}>
          <Input
            label="New price per litre (₹)"
            value={priceInput}
            onChangeText={setPriceInput}
            keyboardType="decimal-pad"
          />
          <Input label="Effective from" value={effectiveFrom} onChangeText={setEffectiveFrom} />
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          <View style={styles.rateFormActions}>
            <Button label="Save rate" onPress={handleSave} loading={submitting} />
            <Button label="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
          </View>
        </View>
      ) : (
        <Button label="Set custom rate" variant="secondary" onPress={() => setShowForm(true)} />
      )}
    </Card>
  );
}

function CustomerBillingSection({ customerId }: { customerId: string }) {
  const [bills, setBills] = useState<MonthlyBillRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listBillsForCustomer(customerId)
      .then(setBills)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load bills'));
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Card style={styles.card}>
      <Text variant="subtitle">Billing history</Text>
      {error ? (
        <Text variant="body" color="danger">
          {error}
        </Text>
      ) : bills === null ? (
        <Text variant="body" color="secondary">
          Loading…
        </Text>
      ) : bills.length === 0 ? (
        <EmptyState
          title="No bills yet"
          description="Create a bill for this customer from the Billing tab."
        />
      ) : (
        bills.map((bill) => (
          <Link key={bill.id} href={`/(admin)/billing/${bill.id}`} asChild>
            <Pressable style={styles.billRow}>
              <Text variant="body">{bill.bill_number}</Text>
              <StatusBadge
                label={BILL_STATUS_LABEL[bill.status]}
                tone={BILL_STATUS_TONE[bill.status]}
              />
              <Text variant="body" color="secondary">
                {formatPaiseAsRupees(bill.total_payable_paise)}
              </Text>
            </Pressable>
          </Link>
        ))
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text variant="label" color="secondary">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { gap: Spacing.sm },
  fieldRow: { gap: 2 },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  actions: { gap: Spacing.sm },
  rateForm: { gap: Spacing.sm },
  rateFormActions: { flexDirection: 'row', gap: Spacing.sm },
});

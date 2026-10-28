import * as Crypto from 'expo-crypto';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChipSelect } from '@/components/chip-select';
import { ErrorState } from '@/components/error-state';
import { Input } from '@/components/input';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge } from '@/components/status-badge';
import { Text } from '@/components/text';
import {
  acknowledgeBillFlag,
  addBillAdjustment,
  finalizeBill,
  getBillWithDetails,
  markBillSent,
  recalculateDraftBill,
  voidBill,
  type BillAdjustmentRow,
  type BillItemRow,
  type BillWithDetails,
  type PaymentRow,
} from '@/lib/api/bills';
import { getBusinessSettings, type BusinessSettingsRow } from '@/lib/api/business-settings';
import { getCustomer, type CustomerRow } from '@/lib/api/customers';
import { listAllMilkTypes } from '@/lib/api/milk-types';
import { recordPayment } from '@/lib/api/payments';
import { BILL_STATUS_LABEL, BILL_STATUS_TONE } from '@/lib/billing/status';
import { formatPaiseAsRupees, parseRupeesToPaise, parseSignedRupeesToPaise } from '@/lib/money';
import { previewHtml, shareHtmlAsPdf } from '@/lib/pdf/generate';
import { renderBillHtml } from '@/lib/pdf/bill-template';
import { billAdjustmentSchema } from '@/lib/validation/bill';
import { PAYMENT_METHOD_OPTIONS, paymentFormSchema } from '@/lib/validation/payment';
import { Spacing } from '@/theme/tokens';
import type { PaymentMethod } from '@/types/database';

type Loaded = {
  details: BillWithDetails;
  customer: CustomerRow;
  milkTypeNames: Record<string, string>;
  business: BusinessSettingsRow;
};

export function BillDetailScreen({ billId }: { billId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidForm, setShowVoidForm] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getBillWithDetails(billId)
      .then(async (details) => {
        const [customer, milkTypes, business] = await Promise.all([
          getCustomer(details.bill.customer_id),
          listAllMilkTypes(),
          getBusinessSettings(),
        ]);
        if (!customer) throw new Error('Customer not found');
        setLoaded({
          details,
          customer,
          milkTypeNames: Object.fromEntries(milkTypes.map((m) => [m.id, m.name])),
          business,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load bill'));
  }, [billId]);

  if (error) {
    return (
      <Screen>
        <ErrorState description={error} onRetry={load} />
      </Screen>
    );
  }

  if (loaded === null) {
    // Kick off the initial load lazily (no effect dependency churn needed — billId is static per screen instance).
    load();
    return (
      <Screen>
        <LoadingState label="Loading bill…" />
      </Screen>
    );
  }

  const { details, customer, milkTypeNames, business } = loaded;
  const { bill, items, adjustments, payments } = details;
  const totalPaid = payments.reduce((sum, p) => (p.voided_at ? sum : sum + p.amount_paise), 0);
  const amountDue = bill.total_payable_paise - totalPaid;

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      load();
    } catch (err) {
      Alert.alert('Action failed', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview() {
    try {
      await previewHtml(buildBillHtml());
    } catch (err) {
      Alert.alert('Preview failed', err instanceof Error ? err.message : undefined);
    }
  }

  async function handleShare() {
    try {
      await shareHtmlAsPdf(buildBillHtml(), `Bill ${bill.bill_number}`);
    } catch (err) {
      Alert.alert('Share failed', err instanceof Error ? err.message : undefined);
    }
  }

  function buildBillHtml(): string {
    return renderBillHtml({
      business: {
        businessName: business.business_name,
        contactPhone: business.contact_phone,
        contactEmail: business.contact_email,
        address: business.address,
      },
      customer: {
        fullName: customer.full_name,
        address: customer.address,
        mobileNumber: customer.mobile_number,
        accountReference: customer.account_reference,
      },
      bill: {
        billNumber: bill.bill_number,
        billingMonth: bill.billing_month,
        status: bill.status,
        previousOutstandingBalancePaise: bill.previous_outstanding_balance_paise,
        subtotalPaise: bill.subtotal_paise,
        adjustmentsTotalPaise: bill.adjustments_total_paise,
        totalPayablePaise: bill.total_payable_paise,
      },
      items: items.map((item) => ({
        deliveryDate: item.delivery_date,
        milkTypeName: milkTypeNames[item.milk_type_id] ?? 'Milk',
        quantityMl: item.quantity_ml,
        pricePaise: item.price_paise,
        amountPaise: item.amount_paise,
      })),
      adjustments: adjustments.map((a) => ({ reason: a.reason, amountPaise: a.amount_paise })),
      payments: payments
        .filter((p) => !p.voided_at)
        .map((p) => ({
          paymentDate: p.payment_date,
          amountPaise: p.amount_paise,
          method: p.method,
          transactionReference: p.transaction_reference,
        })),
    });
  }

  return (
    <Screen scroll>
      <View style={styles.titleRow}>
        <View>
          <Text variant="title">{bill.bill_number}</Text>
          <Text variant="body" color="secondary">
            {customer.full_name} ·{' '}
            {new Date(`${bill.billing_month}T00:00:00Z`).toLocaleDateString('en-IN', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </Text>
        </View>
        <StatusBadge label={BILL_STATUS_LABEL[bill.status]} tone={BILL_STATUS_TONE[bill.status]} />
      </View>

      {bill.flagged_for_review ? (
        <Card style={styles.flagCard}>
          <Text variant="label" color="danger">
            Flagged for review
          </Text>
          <Text variant="body" color="secondary">
            {bill.flagged_reason}
          </Text>
          <Button
            label="Acknowledge"
            variant="secondary"
            loading={busy}
            onPress={() => runAction(() => acknowledgeBillFlag(bill.id))}
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text variant="subtitle">Delivery breakdown</Text>
        {items.length === 0 ? (
          <Text variant="body" color="secondary">
            No billable deliveries this period.
          </Text>
        ) : (
          items.map((item) => (
            <BillItemRowView key={item.id} item={item} milkTypeNames={milkTypeNames} />
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">Totals</Text>
        <TotalsRow
          label="Previous outstanding balance"
          value={bill.previous_outstanding_balance_paise}
        />
        <TotalsRow label="Delivery charges" value={bill.subtotal_paise} />
        <TotalsRow label="Adjustments" value={bill.adjustments_total_paise} />
        <TotalsRow label="Total payable" value={bill.total_payable_paise} emphasize />
        <TotalsRow label="Payments received" value={-totalPaid} />
        <TotalsRow label="Amount due" value={amountDue} emphasize />
      </Card>

      <AdjustmentsSection
        billId={bill.id}
        adjustments={adjustments}
        disabled={bill.status === 'voided'}
        onAdded={load}
      />

      <PaymentsSection
        billId={bill.id}
        payments={payments}
        canRecord={bill.status === 'finalized' || bill.status === 'partially_paid'}
        onRecorded={load}
      />

      <Card style={styles.card}>
        <Text variant="subtitle">Actions</Text>
        <View style={styles.actions}>
          {bill.status === 'draft' ? (
            <>
              <Button
                label="Recalculate"
                variant="secondary"
                loading={busy}
                onPress={() => runAction(() => recalculateDraftBill(bill.id))}
              />
              <Button
                label="Finalize bill"
                loading={busy}
                onPress={() => runAction(() => finalizeBill(bill.id))}
              />
            </>
          ) : null}
          {bill.status !== 'voided' ? (
            <>
              <Button label="Preview PDF" variant="secondary" onPress={handlePreview} />
              <Button label="Share PDF" variant="secondary" onPress={handleShare} />
              {bill.status !== 'draft' ? (
                <Button
                  label={
                    bill.sent_at
                      ? `Sent ${new Date(bill.sent_at).toLocaleDateString()}`
                      : 'Mark as sent'
                  }
                  variant="ghost"
                  disabled={!!bill.sent_at}
                  onPress={() => runAction(() => markBillSent(bill.id))}
                />
              ) : null}
              {showVoidForm ? (
                <View style={styles.form}>
                  <Input
                    label="Reason for voiding this bill"
                    value={voidReason}
                    onChangeText={setVoidReason}
                  />
                  <View style={styles.actions}>
                    <Button
                      label="Confirm void"
                      variant="danger"
                      loading={busy}
                      disabled={voidReason.trim().length === 0}
                      onPress={() =>
                        runAction(() => voidBill(bill.id, voidReason)).then(() => {
                          setShowVoidForm(false);
                          setVoidReason('');
                        })
                      }
                    />
                    <Button label="Cancel" variant="ghost" onPress={() => setShowVoidForm(false)} />
                  </View>
                </View>
              ) : (
                <Button label="Void bill" variant="danger" onPress={() => setShowVoidForm(true)} />
              )}
            </>
          ) : (
            <Text variant="body" color="secondary">
              Voided: {bill.void_reason}
            </Text>
          )}
        </View>
      </Card>
    </Screen>
  );
}

function BillItemRowView({
  item,
  milkTypeNames,
}: {
  item: BillItemRow;
  milkTypeNames: Record<string, string>;
}) {
  return (
    <View style={styles.itemRow}>
      <Text variant="body">
        {item.delivery_date} · {milkTypeNames[item.milk_type_id] ?? 'Milk'}
      </Text>
      <Text variant="body" color="secondary">
        {item.quantity_ml} ml · {formatPaiseAsRupees(item.amount_paise)}
      </Text>
    </View>
  );
}

function TotalsRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.itemRow}>
      <Text variant={emphasize ? 'subtitle' : 'body'} color="secondary">
        {label}
      </Text>
      <Text variant={emphasize ? 'subtitle' : 'body'}>{formatPaiseAsRupees(value)}</Text>
    </View>
  );
}

function AdjustmentsSection({
  billId,
  adjustments,
  disabled,
  onAdded,
}: {
  billId: string;
  adjustments: BillAdjustmentRow[];
  disabled: boolean;
  onAdded: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    const parsed = billAdjustmentSchema.safeParse({ amountRupees: amount, reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the values and try again');
      return;
    }
    const paise = parseSignedRupeesToPaise(parsed.data.amountRupees);
    if (paise === null) {
      setError('Enter a valid amount, e.g. 50 or -50');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await addBillAdjustment(billId, paise, parsed.data.reason);
      setShowForm(false);
      setAmount('');
      setReason('');
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add adjustment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text variant="subtitle">Adjustments</Text>
      {adjustments.length === 0 ? (
        <Text variant="body" color="secondary">
          None yet.
        </Text>
      ) : (
        adjustments.map((a) => (
          <View key={a.id} style={styles.itemRow}>
            <Text variant="body">{a.reason}</Text>
            <Text variant="body" color="secondary">
              {formatPaiseAsRupees(a.amount_paise)}
            </Text>
          </View>
        ))
      )}

      {showForm ? (
        <View style={styles.form}>
          <Input
            label="Amount (₹) — negative for a discount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numbers-and-punctuation"
          />
          <Input label="Reason" value={reason} onChangeText={setReason} />
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button label="Save" onPress={handleSave} loading={submitting} />
            <Button label="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
          </View>
        </View>
      ) : (
        <Button
          label="Add adjustment"
          variant="secondary"
          disabled={disabled}
          onPress={() => setShowForm(true)}
        />
      )}
    </Card>
  );
}

function PaymentsSection({
  billId,
  payments,
  canRecord,
  onRecorded,
}: {
  billId: string;
  payments: PaymentRow[];
  canRecord: boolean;
  onRecorded: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openForm() {
    setPaymentId(Crypto.randomUUID()); // generated once; reused across retries of this attempt
    setShowForm(true);
  }

  async function handleSave() {
    const parsed = paymentFormSchema.safeParse({
      amountRupees: amount,
      method,
      transactionReference,
      paymentDate,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the values and try again');
      return;
    }
    const paise = parseRupeesToPaise(parsed.data.amountRupees);
    if (paise === null || !paymentId) {
      setError('Enter a valid amount');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await recordPayment({
        paymentId,
        billId,
        amountPaise: paise,
        method: parsed.data.method,
        methodDetail: null,
        transactionReference: parsed.data.transactionReference || null,
        paymentDate: parsed.data.paymentDate,
        notes: null,
      });
      setShowForm(false);
      setAmount('');
      setTransactionReference('');
      setPaymentId(null);
      onRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text variant="subtitle">Payments</Text>
      {payments.length === 0 ? (
        <Text variant="body" color="secondary">
          None yet.
        </Text>
      ) : (
        payments.map((p) => (
          <View key={p.id} style={styles.itemRow}>
            <Text variant="body" color={p.voided_at ? 'secondary' : 'default'}>
              {p.payment_date} · {p.method}
              {p.voided_at ? ' (voided)' : ''}
            </Text>
            <Text variant="body" color="secondary">
              {formatPaiseAsRupees(p.amount_paise)}
            </Text>
          </View>
        ))
      )}

      {showForm ? (
        <View style={styles.form}>
          <Input
            label="Amount (₹)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <ChipSelect
            label="Method"
            options={[...PAYMENT_METHOD_OPTIONS]}
            value={method}
            onChange={(v) => v && setMethod(v)}
            scroll={false}
          />
          <Input
            label="Transaction reference (optional)"
            value={transactionReference}
            onChangeText={setTransactionReference}
          />
          <Input label="Payment date" value={paymentDate} onChangeText={setPaymentDate} />
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button label="Save" onPress={handleSave} loading={submitting} />
            <Button label="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
          </View>
        </View>
      ) : (
        <Button
          label="Record payment"
          variant="secondary"
          disabled={!canRecord}
          onPress={openForm}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  flagCard: { gap: Spacing.xs },
  card: { gap: Spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  form: { gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
});

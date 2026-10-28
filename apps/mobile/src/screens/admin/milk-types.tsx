import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorState } from '@/components/error-state';
import { Input } from '@/components/input';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge } from '@/components/status-badge';
import { Text } from '@/components/text';
import {
  createMilkType,
  listAllMilkTypes,
  updateMilkType,
  type MilkTypeRow,
} from '@/lib/api/milk-types';
import { formatPaiseAsRupees, parseRupeesToPaise } from '@/lib/money';
import { Spacing } from '@/theme/tokens';

export function MilkTypesScreen() {
  const [milkTypes, setMilkTypes] = useState<MilkTypeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listAllMilkTypes()
      .then(setMilkTypes)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load milk types'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error) {
    return (
      <Screen>
        <ErrorState description={error} onRetry={load} />
      </Screen>
    );
  }

  if (milkTypes === null) {
    return (
      <Screen>
        <LoadingState label="Loading milk types…" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="title">Milk Types</Text>
      {milkTypes.map((m) => (
        <MilkTypeRowEditor key={m.id} milkType={m} onSaved={load} />
      ))}
      <NewMilkTypeForm onCreated={load} />
    </Screen>
  );
}

function MilkTypeRowEditor({ milkType, onSaved }: { milkType: MilkTypeRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [priceText, setPriceText] = useState(String(milkType.default_price_paise / 100));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const paise = parseRupeesToPaise(priceText);
    if (paise === null) {
      setError('Enter a valid price, e.g. 55 or 55.50');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateMilkType(milkType.id, { defaultPricePaise: paise });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    setSaving(true);
    try {
      await updateMilkType(milkType.id, { isActive: !milkType.is_active });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.rowHeader}>
        <Text variant="subtitle">{milkType.name}</Text>
        <StatusBadge
          label={milkType.is_active ? 'Active' : 'Inactive'}
          tone={milkType.is_active ? 'success' : 'neutral'}
        />
      </View>
      {editing ? (
        <>
          <Input
            label="Default price per litre (₹)"
            value={priceText}
            onChangeText={setPriceText}
            keyboardType="decimal-pad"
          />
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button label="Save" onPress={handleSave} loading={saving} />
            <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
          </View>
        </>
      ) : (
        <>
          <Text variant="body" color="secondary">
            {formatPaiseAsRupees(milkType.default_price_paise)} / litre
          </Text>
          <View style={styles.actions}>
            <Button label="Edit price" variant="secondary" onPress={() => setEditing(true)} />
            <Button
              label={milkType.is_active ? 'Deactivate' : 'Reactivate'}
              variant={milkType.is_active ? 'danger' : 'secondary'}
              loading={saving}
              onPress={handleToggleActive}
            />
          </View>
        </>
      )}
    </Card>
  );
}

function NewMilkTypeForm({ onCreated }: { onCreated: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const paise = parseRupeesToPaise(priceText);
    if (name.trim().length < 2) {
      setError('Enter a milk type name');
      return;
    }
    if (paise === null) {
      setError('Enter a valid price, e.g. 55 or 55.50');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createMilkType({ name: name.trim(), defaultPricePaise: paise });
      setShowForm(false);
      setName('');
      setPriceText('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create milk type');
    } finally {
      setSaving(false);
    }
  }

  if (!showForm) {
    return <Button label="Add milk type" variant="secondary" onPress={() => setShowForm(true)} />;
  }

  return (
    <Card style={styles.card}>
      <Input label="Name" value={name} onChangeText={setName} />
      <Input
        label="Default price per litre (₹)"
        value={priceText}
        onChangeText={setPriceText}
        keyboardType="decimal-pad"
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button label="Create" onPress={handleSave} loading={saving} />
        <Button label="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});

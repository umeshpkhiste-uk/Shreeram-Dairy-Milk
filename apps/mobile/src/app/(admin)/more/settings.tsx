import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Input } from '@/components/input';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/lib/auth/auth-provider';
import {
  getBusinessSettings,
  updateBusinessSettings,
  type BusinessSettingsRow,
} from '@/lib/api/business-settings';
import { Spacing } from '@/theme/tokens';

export default function AdminSettingsScreen() {
  const auth = useAuth();
  const [business, setBusiness] = useState<BusinessSettingsRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getBusinessSettings()
      .then(setBusiness)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load business settings'),
      );
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (auth.status !== 'signedIn') {
    return null; // RouteGuard on the layout handles redirects
  }

  return (
    <Screen scroll>
      <Text variant="title">Settings</Text>

      <Card style={styles.card}>
        <Text variant="subtitle">{auth.profile.full_name}</Text>
        <Text variant="body" color="secondary">
          {auth.session.user.email}
        </Text>
        <Text variant="caption" color="secondary">
          Administrator
        </Text>
      </Card>

      {error ? (
        <Text variant="body" color="danger">
          {error}
        </Text>
      ) : business ? (
        <BusinessSettingsForm business={business} onSaved={load} />
      ) : null}

      <View style={styles.actions}>
        <Button label="Sign out" variant="secondary" onPress={() => auth.signOut()} />
      </View>
    </Screen>
  );
}

function BusinessSettingsForm({
  business,
  onSaved,
}: {
  business: BusinessSettingsRow;
  onSaved: () => void;
}) {
  const [businessName, setBusinessName] = useState(business.business_name);
  const [contactPhone, setContactPhone] = useState(business.contact_phone ?? '');
  const [contactEmail, setContactEmail] = useState(business.contact_email ?? '');
  const [address, setAddress] = useState(business.address ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (businessName.trim().length === 0) {
      setError('Enter a business name');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateBusinessSettings({
        businessName: businessName.trim(),
        contactPhone: contactPhone.trim() || null,
        contactEmail: contactEmail.trim() || null,
        address: address.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text variant="subtitle">Business details</Text>
      <Text variant="caption" color="secondary">
        Shown on the header of every generated bill PDF.
      </Text>
      <Input label="Business name" value={businessName} onChangeText={setBusinessName} />
      <Input label="Contact phone" value={contactPhone} onChangeText={setContactPhone} />
      <Input
        label="Contact email"
        value={contactEmail}
        onChangeText={setContactEmail}
        autoCapitalize="none"
      />
      <Input label="Address" value={address} onChangeText={setAddress} />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
      <Button label="Save" onPress={handleSave} loading={saving} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  actions: { marginTop: Spacing.sm },
});

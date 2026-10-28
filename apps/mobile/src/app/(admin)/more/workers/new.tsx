import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChipSelect } from '@/components/chip-select';
import { Input } from '@/components/input';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { createWorkerAccount } from '@/lib/api/admin-create-worker';
import { listRoutes } from '@/lib/api/workers';
import { Spacing } from '@/theme/tokens';
import type { Database } from '@/types/database';

type RouteRow = Database['public']['Tables']['routes']['Row'];

export default function NewWorkerScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [routeId, setRouteId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRoutes()
      .then(setRoutes)
      .catch(() => {});
  }, []);

  const canSubmit =
    fullName.trim().length >= 2 && email.includes('@') && password.length >= 8 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createWorkerAccount({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        routeId,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create worker account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Text variant="body" color="secondary">
        Creates a sign-in account for this worker immediately. Share the password with them securely
        — there is no invite email in this version.
      </Text>

      <View style={styles.form}>
        <Input label="Full name" value={fullName} onChangeText={setFullName} />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label="Phone (optional)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Input
          label="Temporary password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        {routes.length > 0 ? (
          <ChipSelect
            label="Route (optional)"
            options={routes.map((r) => ({ value: r.id, label: r.name }))}
            value={routeId}
            onChange={setRouteId}
            allowClear
          />
        ) : null}

        {error ? (
          <Text variant="body" color="danger">
            {error}
          </Text>
        ) : null}

        <Button
          label="Create worker account"
          onPress={handleSubmit}
          loading={submitting}
          fullWidth
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md },
});

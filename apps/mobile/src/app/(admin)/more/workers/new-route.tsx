import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { createRoute } from '@/lib/api/workers';
import { Spacing } from '@/theme/tokens';

export default function NewRouteScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length >= 2 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createRoute({ name: name.trim(), description: description.trim() || undefined });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create route');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.form}>
        <Input
          label="Route name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. North Zone"
        />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        {error ? (
          <Text variant="body" color="danger">
            {error}
          </Text>
        ) : null}
        <Button label="Add Route" onPress={handleSubmit} loading={submitting} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md },
});

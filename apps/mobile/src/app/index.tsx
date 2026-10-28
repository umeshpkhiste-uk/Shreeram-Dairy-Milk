import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Spacing } from '@/theme/tokens';

/**
 * Temporary development entry point.
 *
 * There is no authentication yet (Stage 2 adds Supabase Auth and real role
 * resolution from `profiles.role`). This screen exists only so the two
 * navigators built in Stage 1 are reachable for review, and will be removed
 * once sign-in redirects to the correct navigator automatically.
 */
export default function DevEntryScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Shreeram Daily Milk</Text>
        <Text variant="body" color="secondary">
          Development preview — sign-in is not implemented yet.
        </Text>
      </View>

      <Card>
        <Text variant="subtitle">Preview a role</Text>
        <Text variant="body" color="secondary">
          Choose a navigator to review. This screen is replaced by real sign-in in Stage 2.
        </Text>
        <View style={styles.actions}>
          <Button label="Admin" onPress={() => router.replace('/(admin)/dashboard')} />
          <Button
            label="Delivery worker"
            variant="secondary"
            onPress={() => router.replace('/(worker)/today')}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
});

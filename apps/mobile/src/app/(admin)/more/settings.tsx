import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/lib/auth/auth-provider';
import { Spacing } from '@/theme/tokens';

export default function AdminSettingsScreen() {
  const auth = useAuth();

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

      <EmptyState
        title="Business settings not implemented yet"
        description="Business name, contact details, and milk pricing configuration land as each underlying feature does, starting with milk pricing in Stage 5."
      />

      <View style={styles.actions}>
        <Button label="Sign out" variant="secondary" onPress={() => auth.signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.xs },
  actions: { marginTop: Spacing.sm },
});

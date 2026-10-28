import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/lib/auth/auth-provider';
import { Spacing } from '@/theme/tokens';

export default function PendingActivationScreen() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return <LoadingState label="Loading…" />;
  }

  if (auth.status === 'signedOut') {
    return <Redirect href="/sign-in" />;
  }

  if (auth.profile.is_active) {
    return <Redirect href="/" />;
  }

  return (
    <Screen style={styles.center}>
      <Text variant="title" style={styles.centerText}>
        Account pending activation
      </Text>
      <Text variant="body" color="secondary" style={styles.centerText}>
        Your account has been created but is not active yet. Contact your administrator to activate
        it.
      </Text>
      <View style={styles.actions}>
        <Button label="Sign out" variant="secondary" onPress={() => auth.signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  centerText: { textAlign: 'center' },
  actions: { marginTop: Spacing.md },
});

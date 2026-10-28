import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/lib/auth/auth-provider';
import { Spacing } from '@/theme/tokens';

export default function WorkerProfileScreen() {
  const auth = useAuth();

  if (auth.status !== 'signedIn') {
    return null; // RouteGuard on the layout handles redirects
  }

  return (
    <Screen>
      <Text variant="title">Profile</Text>
      <Card style={styles.card}>
        <Text variant="subtitle">{auth.profile.full_name}</Text>
        <Text variant="body" color="secondary">
          {auth.session.user.email}
        </Text>
        {auth.profile.phone ? (
          <Text variant="body" color="secondary">
            {auth.profile.phone}
          </Text>
        ) : null}
      </Card>
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

import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/lib/auth/auth-provider';
import { countFailedOutboxItems, countPendingOutboxItems } from '@/lib/sqlite/outbox-repo';
import { Spacing } from '@/theme/tokens';

export default function WorkerProfileScreen() {
  const auth = useAuth();

  if (auth.status !== 'signedIn') {
    return null; // RouteGuard on the layout handles redirects
  }

  function handleSignOutPress() {
    const unsynced = countPendingOutboxItems() + countFailedOutboxItems();
    if (unsynced === 0) {
      auth.signOut();
      return;
    }
    Alert.alert(
      'Unsynced deliveries on this device',
      `You have ${unsynced} delivery record${unsynced === 1 ? '' : 's'} not yet synced to the server. ` +
        'Signing out now will discard them from this device — they will not be recorded. ' +
        'Connect to the internet and wait for sync to finish first if possible.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out anyway', style: 'destructive', onPress: () => auth.signOut() },
      ],
    );
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
        <Button label="Sign out" variant="secondary" onPress={handleSignOutPress} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.xs },
  actions: { marginTop: Spacing.sm },
});

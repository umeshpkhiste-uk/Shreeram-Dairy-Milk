import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Spacing } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <Screen style={styles.center}>
      <Text variant="title">Screen not found</Text>
      <Link href="/">
        <Text variant="body" color="primary">
          Go back home
        </Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
});

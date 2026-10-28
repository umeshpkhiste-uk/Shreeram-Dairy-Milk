import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { Spacing } from '@/theme/tokens';

export type ErrorStateProps = {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'Something went wrong',
  description,
  retryLabel = 'Try again',
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text variant="subtitle" color="danger" style={styles.centerText}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="secondary" style={styles.centerText}>
          {description}
        </Text>
      ) : null}
      {onRetry ? <Button label={retryLabel} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  centerText: { textAlign: 'center' },
});

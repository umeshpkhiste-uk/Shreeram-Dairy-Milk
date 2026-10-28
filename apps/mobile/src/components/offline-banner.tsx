import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme/tokens';

export type OfflineBannerProps = {
  /** True when the device has no network connectivity. */
  isOffline: boolean;
  /** Count of locally saved records waiting to reach the server. */
  pendingCount?: number;
};

/**
 * Presentational-only banner. Wired to real connectivity + outbox state in
 * Stage 3 (offline delivery recording and synchronization).
 */
export function OfflineBanner({ isOffline, pendingCount = 0 }: OfflineBannerProps) {
  const theme = useTheme();

  if (!isOffline && pendingCount === 0) {
    return null;
  }

  const tone = isOffline
    ? { bg: theme.warningBg, fg: theme.warning }
    : { bg: theme.infoBg, fg: theme.info };

  const message = isOffline
    ? pendingCount > 0
      ? `Offline — ${pendingCount} record${pendingCount === 1 ? '' : 's'} waiting to sync`
      : 'Offline — changes will sync automatically when connected'
    : `Syncing ${pendingCount} pending record${pendingCount === 1 ? '' : 's'}…`;

  return (
    <View style={[styles.banner, { backgroundColor: tone.bg }]} accessibilityLiveRegion="polite">
      <Text variant="label" style={{ color: tone.fg }}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
});

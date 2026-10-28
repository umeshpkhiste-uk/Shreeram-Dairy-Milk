import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme/tokens';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

/** Small coloured pill used for delivery status, sync status, and bill status. */
export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  const theme = useTheme();

  const toneStyle = {
    neutral: { bg: theme.surfaceMuted, fg: theme.textSecondary },
    success: { bg: theme.successBg, fg: theme.success },
    warning: { bg: theme.warningBg, fg: theme.warning },
    danger: { bg: theme.dangerBg, fg: theme.danger },
    info: { bg: theme.infoBg, fg: theme.info },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.bg }]}>
      <Text variant="caption" style={{ color: toneStyle.fg, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: Radius.full,
  },
});

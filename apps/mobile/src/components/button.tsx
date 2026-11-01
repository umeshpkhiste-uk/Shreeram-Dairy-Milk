import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { MinTouchTarget, Radius, Spacing, palette } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const variantStyle = {
    // Fixed brand colors, not theme.primary/theme.danger — the web app has
    // no dark mode, so its buttons are always #174A30/#B3261E. Pinning these
    // two here (instead of letting them shift to dark-mode tints) keeps the
    // brand CTA color identical between web and mobile regardless of the
    // phone's theme, same as any brand keeping its primary button color
    // fixed across light/dark.
    primary: { backgroundColor: palette.green700, borderColor: palette.green700 },
    // surfaceMuted, not surface — surface sits almost on top of the screen
    // background in dark mode (#111A15 vs #0B1210), so a secondary button's
    // fill was nearly invisible; surfaceMuted gives it real contrast.
    secondary: { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
    danger: { backgroundColor: palette.red500, borderColor: palette.red500 },
    ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  }[variant];

  const textColor =
    variant === 'secondary' || variant === 'ghost' ? theme.text : palette.white;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text variant="subtitle" style={{ color: textColor }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MinTouchTarget,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

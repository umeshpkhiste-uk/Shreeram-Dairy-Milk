import { ActivityIndicator, Pressable, StyleSheet, type GestureResponderEvent, type PressableProps } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { usePressGuard } from '@/lib/use-press-guard';
import { MinTouchTarget, Radius, Spacing, palette } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  /** Grow to fill the parent's height, e.g. equal-height buttons in a grid row. */
  fill?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  fill = false,
  disabled,
  onPress,
  // <Link asChild> injects its own `style` into this component; drop it so
  // it can never replace the button's own styling below.
  style: _injectedStyle,
  ...rest
}: ButtonProps & { style?: unknown }) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  // Every button in the app funnels through here, so this one guard is what
  // makes "only single taps do anything" true app-wide, not just wherever a
  // screen happens to remember to pass `loading`/`disabled` itself.
  const guardedOnPress = usePressGuard<[GestureResponderEvent]>(onPress ?? undefined);

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
      {...rest}
      onPress={guardedOnPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        // Hug the label by default — a View's default alignItems is
        // 'stretch', so a button with no explicit sizing silently fills
        // whatever container it's placed in (most commonly Card, which
        // doesn't override alignItems either). fullWidth/fill opt back into
        // stretching when that's actually wanted.
        !fullWidth && !fill && styles.hug,
        fullWidth && styles.fullWidth,
        fill && styles.fill,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text variant="subtitle" style={{ color: textColor, textAlign: 'center' }}>
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
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hug: { alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  fill: { flex: 1 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

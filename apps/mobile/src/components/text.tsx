import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { FontSizes } from '@/theme/tokens';

export type TextVariant = 'title' | 'subtitle' | 'body' | 'label' | 'caption';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: 'default' | 'secondary' | 'primary' | 'danger' | 'success';
};

export function Text({ variant = 'body', color = 'default', style, ...rest }: TextProps) {
  const theme = useTheme();

  const colorMap = {
    default: theme.text,
    secondary: theme.textSecondary,
    primary: theme.primary,
    danger: theme.danger,
    success: theme.success,
  };

  return (
    <RNText
      style={[styles[variant], { color: colorMap[color] }, style]}
      accessibilityRole={variant === 'title' ? 'header' : undefined}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSizes.xxl, fontWeight: '700', lineHeight: FontSizes.xxl * 1.25 },
  subtitle: { fontSize: FontSizes.lg, fontWeight: '600', lineHeight: FontSizes.lg * 1.3 },
  body: { fontSize: FontSizes.md, fontWeight: '400', lineHeight: FontSizes.md * 1.4 },
  label: { fontSize: FontSizes.sm, fontWeight: '600', lineHeight: FontSizes.sm * 1.3 },
  caption: { fontSize: FontSizes.xs, fontWeight: '400', lineHeight: FontSizes.xs * 1.3 },
});

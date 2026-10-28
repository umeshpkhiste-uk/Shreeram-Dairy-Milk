import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { MinTouchTarget, Radius, Spacing } from '@/theme/tokens';

export type ChipOption<T extends string> = { value: T; label: string };

export type ChipSelectProps<T extends string> = {
  label?: string;
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  allowClear?: boolean;
  scroll?: boolean;
};

/** Single-select chip row — used for worker/route/milk-type/status pickers. */
export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  allowClear = false,
  scroll = true,
}: ChipSelectProps<T>) {
  const theme = useTheme();

  const chips = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onChange(selected && allowClear ? null : option.value)}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? theme.primary : theme.surfaceMuted,
            borderColor: selected ? theme.primary : theme.border,
          },
        ]}
      >
        <Text variant="label" style={{ color: selected ? theme.textOnPrimary : theme.text }}>
          {option.label}
        </Text>
      </Pressable>
    );
  });

  const content = scroll ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips}
    </ScrollView>
  ) : (
    <View style={styles.wrapRow}>{chips}</View>
  );

  return (
    <View style={styles.container}>
      {label ? <Text variant="label">{label}</Text> : null}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  row: { gap: Spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: MinTouchTarget * 0.7,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
});

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { MinTouchTarget, Radius, Spacing } from '@/theme/tokens';

export type SelectOption<T extends string> = { value: T; label: string };

export type SelectProps<T extends string> = {
  label?: string;
  placeholder?: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  allowClear?: boolean;
};

/**
 * Single-select dropdown — tapping the field opens a bottom sheet listing
 * every option. React Native has no cross-platform native <select>, so a
 * bottom sheet is the standard mobile stand-in; this is a drop-in
 * alternative to ChipSelect for filters with a "current value" at a time.
 */
export function Select<T extends string>({
  label,
  placeholder = 'All',
  options,
  value,
  onChange,
  allowClear = false,
}: SelectProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? placeholder;

  function pick(next: T | null) {
    onChange(next);
    setOpen(false);
  }

  return (
    <View style={styles.container}>
      {label ? <Text variant="label">{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: theme.border, backgroundColor: theme.surface }]}
      >
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.fieldText, { color: value ? theme.text : theme.textSecondary }]}
        >
          {selectedLabel}
        </Text>
        <Text variant="body" color="secondary">
          ▾
        </Text>
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.surface }]} onPress={() => {}}>
            {label ? (
              <Text variant="subtitle" style={styles.sheetTitle}>
                {label}
              </Text>
            ) : null}
            <ScrollView contentContainerStyle={styles.optionList}>
              {allowClear ? (
                <Option label={placeholder} selected={value === null} onPress={() => pick(null)} />
              ) : null}
              {options.map((option) => (
                <Option
                  key={option.value}
                  label={option.label}
                  selected={option.value === value}
                  onPress={() => pick(option.value)}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, selected && { backgroundColor: theme.primaryMuted }]}
    >
      <Text variant="body" style={{ color: selected ? theme.primary : theme.text }}>
        {label}
      </Text>
      {selected ? (
        <Text variant="body" style={{ color: theme.primary }}>
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  field: {
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  fieldText: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '70%',
    paddingBottom: Spacing.lg,
  },
  sheetTitle: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  optionList: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  option: {
    minHeight: MinTouchTarget,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

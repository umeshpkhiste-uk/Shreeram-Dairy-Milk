import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme/tokens';

type ScreenProps = ViewProps & {
  scroll?: boolean;
  padded?: boolean;
};

/** Base screen container: themed background, safe-area aware, optional scrolling. */
export function Screen({ scroll = false, padded = true, style, children, ...rest }: ScreenProps) {
  const theme = useTheme();
  const Container = scroll ? ScrollView : View;
  const containerProps = scroll
    ? { contentContainerStyle: [padded && styles.padded, style] }
    : { style: [{ flex: 1 }, padded && styles.padded, style] };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Container {...containerProps} {...rest}>
        {children}
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  padded: { padding: Spacing.lg, gap: Spacing.lg },
});

import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme/tokens';

const menuItems = [
  { href: '/(admin)/more/workers', label: 'Workers & Routes', icon: 'map-outline' as const },
  { href: '/(admin)/more/payments', label: 'Payments', icon: 'cash-outline' as const },
  { href: '/(admin)/more/reports', label: 'Reports', icon: 'bar-chart-outline' as const },
  { href: '/(admin)/more/settings', label: 'Settings', icon: 'settings-outline' as const },
] as const;

export default function MoreMenuScreen() {
  const theme = useTheme();

  return (
    <Screen scroll>
      <Text variant="title">More</Text>
      <View style={styles.list}>
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable>
              <Card style={styles.row}>
                <Ionicons name={item.icon} size={22} color={theme.icon} />
                <Text variant="subtitle" style={styles.rowLabel}>
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.icon} />
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowLabel: { flex: 1 },
});

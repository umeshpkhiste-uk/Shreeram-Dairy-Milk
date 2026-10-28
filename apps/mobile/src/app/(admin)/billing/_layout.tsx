import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function BillingStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Billing' }} />
      <Stack.Screen name="[id]" options={{ title: 'Bill' }} />
    </Stack>
  );
}

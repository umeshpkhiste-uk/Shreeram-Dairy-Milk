import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function CustomersStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Customers' }} />
      <Stack.Screen name="new" options={{ title: 'Add Customer', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Customer' }} />
    </Stack>
  );
}

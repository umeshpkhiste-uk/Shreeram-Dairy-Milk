import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function DeliveriesStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Deliveries' }} />
      <Stack.Screen name="[customerId]" options={{ title: 'Delivery calendar' }} />
    </Stack>
  );
}

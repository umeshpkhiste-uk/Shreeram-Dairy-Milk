import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function HistoryStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Delivery History', headerShown: false }} />
      <Stack.Screen name="[customerId]" options={{ title: 'Delivery summary' }} />
    </Stack>
  );
}

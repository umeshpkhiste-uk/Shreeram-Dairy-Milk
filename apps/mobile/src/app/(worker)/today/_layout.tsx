import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function TodayStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Today's Route", headerShown: false }} />
      <Stack.Screen name="[customerId]" options={{ title: 'Delivery calendar' }} />
    </Stack>
  );
}

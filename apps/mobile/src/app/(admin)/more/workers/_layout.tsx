import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function WorkersStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Workers & Routes' }} />
      <Stack.Screen name="new" options={{ title: 'Add Worker', presentation: 'modal' }} />
      <Stack.Screen name="new-route" options={{ title: 'Add Route', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Worker' }} />
    </Stack>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { useTheme } from '@/hooks/use-theme';
import { RouteGuard } from '@/lib/auth/route-guard';
import { initSyncEngine } from '@/lib/sync/sync-engine';

export default function WorkerTabsLayout() {
  const theme = useTheme();

  useEffect(() => {
    // Starts the standard sync triggers (startup, foreground, connectivity
    // restored) once a worker is in their tabs — see docs/offline-sync.md.
    initSyncEngine();
  }, []);

  return (
    <RouteGuard role="worker">
      <WorkerTabs theme={theme} />
    </RouteGuard>
  );
}

function WorkerTabs({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today's Route",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bicycle-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync Status',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sync-outline" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}

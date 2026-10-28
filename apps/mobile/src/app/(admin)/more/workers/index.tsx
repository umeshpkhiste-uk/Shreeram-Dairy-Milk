import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge } from '@/components/status-badge';
import { Text } from '@/components/text';
import { listRoutes, listWorkers, type WorkerSummary } from '@/lib/api/workers';
import { Spacing } from '@/theme/tokens';
import type { Database } from '@/types/database';

type RouteRow = Database['public']['Tables']['routes']['Row'];

export default function WorkersAndRoutesScreen() {
  const [workers, setWorkers] = useState<WorkerSummary[] | null>(null);
  const [routes, setRoutes] = useState<RouteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([listWorkers(), listRoutes()])
      .then(([w, r]) => {
        setWorkers(w);
        setRoutes(r);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error) {
    return (
      <Screen>
        <ErrorState description={error} onRetry={load} />
      </Screen>
    );
  }

  if (!workers || !routes) {
    return (
      <Screen>
        <LoadingState label="Loading workers and routes…" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.sectionHeader}>
        <Text variant="subtitle">Workers</Text>
        <Link href="/(admin)/more/workers/new" asChild>
          <Button label="Add Worker" />
        </Link>
      </View>
      {workers.length === 0 ? (
        <EmptyState title="No workers yet" description="Add your first delivery worker." />
      ) : (
        <View style={styles.list}>
          {workers.map((w) => (
            <Link key={w.id} href={`/(admin)/more/workers/${w.id}`} asChild>
              <Pressable>
                <Card style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text variant="subtitle">{w.fullName}</Text>
                    <Text variant="body" color="secondary">
                      {w.route ? w.route.name : 'No route assigned'}
                    </Text>
                  </View>
                  <StatusBadge
                    label={w.isActive ? 'Active' : 'Inactive'}
                    tone={w.isActive ? 'success' : 'neutral'}
                  />
                </Card>
              </Pressable>
            </Link>
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text variant="subtitle">Routes</Text>
        <Link href="/(admin)/more/workers/new-route" asChild>
          <Button label="Add Route" variant="secondary" />
        </Link>
      </View>
      {routes.length === 0 ? (
        <EmptyState title="No routes yet" description="Add a delivery route to organize workers." />
      ) : (
        <View style={styles.list}>
          {routes.map((r) => (
            <Card key={r.id} style={styles.routeCard}>
              <Text variant="subtitle">{r.name}</Text>
              {r.description ? (
                <Text variant="body" color="secondary">
                  {r.description}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  rowMain: { gap: 2 },
  routeCard: { gap: 2 },
});

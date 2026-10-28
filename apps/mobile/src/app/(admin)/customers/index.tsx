import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChipSelect } from '@/components/chip-select';
import { ErrorState } from '@/components/error-state';
import { EmptyState } from '@/components/empty-state';
import { Input } from '@/components/input';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { StatusBadge } from '@/components/status-badge';
import { Text } from '@/components/text';
import { listCustomers, type CustomerRow } from '@/lib/api/customers';
import { Spacing } from '@/theme/tokens';
import type { CustomerStatus } from '@/types/database';

const STATUS_OPTIONS: { value: CustomerStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function CustomersListScreen() {
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomerStatus | 'all'>('active');

  const load = useCallback(() => {
    setError(null);
    listCustomers({ status, search })
      .then(setCustomers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load customers'));
  }, [status, search]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Input
          placeholder="Search by name or mobile number"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        <ChipSelect
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => setStatus((v ?? 'all') as CustomerStatus | 'all')}
          scroll={false}
        />
        <Link href="/(admin)/customers/new" asChild>
          <Button label="Add Customer" />
        </Link>
      </View>

      <CustomerListBody customers={customers} error={error} search={search} onRetry={load} />
    </Screen>
  );
}

function CustomerListBody({
  customers,
  error,
  search,
  onRetry,
}: {
  customers: CustomerRow[] | null;
  error: string | null;
  search: string;
  onRetry: () => void;
}) {
  if (error) {
    return <ErrorState description={error} onRetry={onRetry} />;
  }

  if (customers === null) {
    return <LoadingState label="Loading customers…" />;
  }

  if (customers.length === 0) {
    return (
      <EmptyState
        title="No customers found"
        description={
          search ? 'No customers match your search.' : 'Add your first customer to get started.'
        }
      />
    );
  }

  return (
    <FlatList
      data={customers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Link href={`/(admin)/customers/${item.id}`} asChild>
          <Pressable>
            <Card style={styles.row}>
              <View style={styles.rowMain}>
                <Text variant="subtitle">{item.full_name}</Text>
                <Text variant="body" color="secondary">
                  {item.mobile_number}
                </Text>
              </View>
              <StatusBadge
                label={item.status === 'active' ? 'Active' : 'Inactive'}
                tone={item.status === 'active' ? 'success' : 'neutral'}
              />
            </Card>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: { padding: Spacing.lg, gap: Spacing.md },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  rowMain: { gap: 2 },
});

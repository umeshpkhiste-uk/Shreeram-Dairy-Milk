import { useLocalSearchParams } from 'expo-router';

import { BillDetailScreen } from '@/screens/admin/bill-detail';

export default function BillDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BillDetailScreen billId={id} />;
}

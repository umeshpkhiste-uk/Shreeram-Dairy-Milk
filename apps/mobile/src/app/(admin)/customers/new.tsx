import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Screen } from '@/components/screen';
import { createCustomer, findActiveCustomersByMobileNumber } from '@/lib/api/customers';
import { CustomerForm } from '@/screens/admin/customer-form';
import type { CustomerFormValues } from '@/lib/validation/customer';

function confirmDuplicate(names: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Possible duplicate',
      `An active customer with this mobile number already exists (${names.join(', ')}). Add this customer anyway?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Add anyway', onPress: () => resolve(true) },
      ],
    );
  });
}

export default function NewCustomerScreen() {
  async function handleSubmit(values: CustomerFormValues) {
    const duplicates = await findActiveCustomersByMobileNumber(values.mobileNumber);
    if (duplicates.length > 0) {
      const proceed = await confirmDuplicate(duplicates.map((d) => d.full_name));
      if (!proceed) return;
    }

    const customer = await createCustomer(values);
    router.replace(`/(admin)/customers/${customer.id}`);
  }

  return (
    <Screen scroll>
      <CustomerForm submitLabel="Add Customer" onSubmit={handleSubmit} />
    </Screen>
  );
}

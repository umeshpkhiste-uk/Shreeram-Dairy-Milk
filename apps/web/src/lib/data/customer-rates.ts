import type { Database } from '@shreeram/shared';

import type { SupabaseServerClient } from './types';

export type CustomerMilkRateRow = Database['public']['Tables']['customer_milk_rates']['Row'];

export async function listRatesForCustomer(
  supabase: SupabaseServerClient,
  customerId: string,
): Promise<CustomerMilkRateRow[]> {
  const { data, error } = await supabase
    .from('customer_milk_rates')
    .select('*')
    .eq('customer_id', customerId)
    .order('effective_from', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Closes the open rate for the same customer and product at `effectiveFrom` (an
 * exclusive upper bound) and opens the new one, together or not at all.
 */
export async function setCustomerRate(
  supabase: SupabaseServerClient,
  input: {
    customerId: string;
    milkTypeId: string;
    pricePaise: number;
    effectiveFrom: string; // YYYY-MM-DD
  },
): Promise<void> {
  const { error } = await supabase.rpc('set_customer_rate', {
    p_customer_id: input.customerId,
    p_milk_type_id: input.milkTypeId,
    p_price_paise: input.pricePaise,
    p_effective_from: input.effectiveFrom,
  });
  if (error) throw error;
}

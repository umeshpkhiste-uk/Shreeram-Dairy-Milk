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
 * Sets a new customer-specific rate effective from `effectiveFrom`, closing
 * any currently-open rate for the same customer + milk type at that exact
 * date (an exclusive upper bound — see `resolve_milk_price_paise` in
 * supabase/migrations/20261028090002_stage3_submit_delivery_event_rpc.sql).
 * Historical rates already attached to past deliveries are never edited or
 * removed — see docs/billing.md for how the applicable historical rate is
 * resolved for a given delivery's date.
 */
export async function setCustomerRate(
  supabase: SupabaseServerClient,
  input: {
    customerId: string;
    milkTypeId: string;
    pricePaise: number;
    effectiveFrom: string; // YYYY-MM-DD
  },
): Promise<CustomerMilkRateRow> {
  const { error: closeError } = await supabase
    .from('customer_milk_rates')
    .update({ effective_to: input.effectiveFrom })
    .eq('customer_id', input.customerId)
    .eq('milk_type_id', input.milkTypeId)
    .is('effective_to', null);
  if (closeError) throw closeError;

  const { data, error } = await supabase
    .from('customer_milk_rates')
    .insert({
      customer_id: input.customerId,
      milk_type_id: input.milkTypeId,
      price_paise: input.pricePaise,
      effective_from: input.effectiveFrom,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

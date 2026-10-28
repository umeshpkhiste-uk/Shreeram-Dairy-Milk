import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

export type CustomerMilkRateRow = Database['public']['Tables']['customer_milk_rates']['Row'];

export async function listRatesForCustomer(customerId: string): Promise<CustomerMilkRateRow[]> {
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
 * any currently-open rate for the same customer + milk type the day before.
 * Two sequential requests rather than a single DB transaction (acceptable
 * for low-concurrency admin-only usage) — a `customer_milk_rates_one_open_rate_idx`
 * unique index still prevents two open rates existing at once even if this
 * races. Historical rates already attached to past deliveries are never
 * edited or removed, by design — see Stage 5 (billing) for how the
 * applicable historical rate is resolved for a given delivery's date.
 */
export async function setCustomerRate(input: {
  customerId: string;
  milkTypeId: string;
  pricePaise: number;
  effectiveFrom: string; // YYYY-MM-DD
}): Promise<CustomerMilkRateRow> {
  const dayBefore = new Date(input.effectiveFrom);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const effectiveTo = dayBefore.toISOString().slice(0, 10);

  const { error: closeError } = await supabase
    .from('customer_milk_rates')
    .update({ effective_to: effectiveTo })
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

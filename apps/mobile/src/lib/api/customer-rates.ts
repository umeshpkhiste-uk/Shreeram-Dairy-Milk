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
 * any currently-open rate for the same customer + milk type at that exact
 * date. `resolve_milk_price_paise`'s window is `effective_from <= as_of <
 * effective_to` (exclusive upper bound — see
 * supabase/migrations/20261028090002_stage3_submit_delivery_event_rpc.sql),
 * so `effective_to` must equal the new rate's `effective_from`, not the day
 * before it — closing it a day early leaves that one day covered by neither
 * rate, silently falling back to the milk type's default price. (Found and
 * fixed in Stage 7 while building the website's equivalent of this
 * function — confirmed live against the real project.)
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

import { supabase } from '@/lib/supabase/client';
import type { CustomerFormValues } from '@/lib/validation/customer';
import type { CustomerStatus, Database } from '@/types/database';

export type CustomerRow = Database['public']['Tables']['customers']['Row'];

export type CustomerFilters = {
  status?: CustomerStatus | 'all';
  workerId?: string;
  routeId?: string;
  search?: string;
};

export async function listCustomers(filters: CustomerFilters = {}): Promise<CustomerRow[]> {
  let query = supabase.from('customers').select('*');

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.workerId) {
    query = query.eq('assigned_worker_id', filters.workerId);
  }
  if (filters.routeId) {
    query = query.eq('route_id', filters.routeId);
  }
  if (filters.search && filters.search.trim().length > 0) {
    const term = filters.search.trim();
    query = query.or(`full_name.ilike.%${term}%,mobile_number.ilike.%${term}%`);
  }

  const { data, error } = await query.order('full_name');
  if (error) throw error;
  return data ?? [];
}

export async function getCustomer(id: string): Promise<CustomerRow | null> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

function toCustomerFields(values: CustomerFormValues) {
  return {
    full_name: values.fullName,
    mobile_number: values.mobileNumber,
    email: values.email || null,
    address: values.address,
    locality: values.locality || null,
    landmark: values.landmark || null,
    assigned_worker_id: values.assignedWorkerId ?? null,
    route_id: values.routeId ?? null,
    route_sequence: values.routeSequence ?? null,
    default_daily_quantity_ml: values.defaultDailyQuantityMl,
    milk_type_id: values.milkTypeId,
    preferred_delivery_window: values.preferredDeliveryWindow || null,
    delivery_start_date: values.deliveryStartDate,
    notes: values.notes || null,
    billing_contact_name: values.billingContactName || null,
    billing_contact_phone: values.billingContactPhone || null,
    account_reference: values.accountReference || null,
  };
}

/**
 * Duplicate-number check: surfaced to the admin as a confirmation prompt
 * rather than a hard block, per the product brief ("avoid duplicate customer
 * records where practical, while allowing the admin to resolve genuine
 * duplicate-number cases" — e.g. a shared household landline).
 */
export async function findActiveCustomersByMobileNumber(
  mobileNumber: string,
): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('mobile_number', mobileNumber)
    .eq('status', 'active');
  if (error) throw error;
  return data ?? [];
}

export async function createCustomer(values: CustomerFormValues): Promise<CustomerRow> {
  const { data, error } = await supabase
    .from('customers')
    .insert(toCustomerFields(values))
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(id: string, values: CustomerFormValues): Promise<CustomerRow> {
  const { data, error } = await supabase
    .from('customers')
    .update(toCustomerFields(values))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Customers are never hard-deleted (historical delivery/billing records must
 * stay valid) — deactivation sets status only, and the audit trigger on
 * `customers` records the change.
 */
export async function setCustomerStatus(id: string, status: CustomerStatus): Promise<void> {
  const { error } = await supabase.from('customers').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function listCustomersForWorker(workerId: string): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('assigned_worker_id', workerId)
    .eq('status', 'active')
    .order('route_sequence', { ascending: true, nullsFirst: false })
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}

export async function setCustomerRouteSequence(
  id: string,
  routeSequence: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ route_sequence: routeSequence })
    .eq('id', id);
  if (error) throw error;
}

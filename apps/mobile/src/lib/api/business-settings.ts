import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

export type BusinessSettingsRow = Database['public']['Tables']['business_settings']['Row'];

/** Singleton row (id = true). Readable by any authenticated user, admin-only to update. */
export async function getBusinessSettings(): Promise<BusinessSettingsRow> {
  const { data, error } = await supabase.from('business_settings').select('*').single();
  if (error) throw error;
  return data;
}

export async function updateBusinessSettings(input: {
  businessName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
}): Promise<BusinessSettingsRow> {
  const { data, error } = await supabase
    .from('business_settings')
    .update({
      business_name: input.businessName,
      contact_phone: input.contactPhone,
      contact_email: input.contactEmail,
      address: input.address,
    })
    .eq('id', true)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

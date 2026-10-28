'use server';

import { customerFormSchema, type CustomerFormValues } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createCustomer, setCustomerStatus, updateCustomer } from '@/lib/data/customers';
import { createClient } from '@/lib/supabase/server';

export type CustomerActionState = { error: string | null };

function parseFormValues(formData: FormData): unknown {
  const routeSequenceRaw = formData.get('routeSequence');
  const quantityRaw = formData.get('defaultDailyQuantityMl');
  return {
    fullName: String(formData.get('fullName') ?? ''),
    mobileNumber: String(formData.get('mobileNumber') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
    locality: String(formData.get('locality') ?? ''),
    landmark: String(formData.get('landmark') ?? ''),
    assignedWorkerId: formData.get('assignedWorkerId') || null,
    routeId: formData.get('routeId') || null,
    routeSequence: routeSequenceRaw ? Number(routeSequenceRaw) : null,
    defaultDailyQuantityMl: quantityRaw ? Number(quantityRaw) : undefined,
    milkTypeId: String(formData.get('milkTypeId') ?? ''),
    preferredDeliveryWindow: String(formData.get('preferredDeliveryWindow') ?? ''),
    deliveryStartDate: String(formData.get('deliveryStartDate') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    billingContactName: String(formData.get('billingContactName') ?? ''),
    billingContactPhone: String(formData.get('billingContactPhone') ?? ''),
    accountReference: String(formData.get('accountReference') ?? ''),
  };
}

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'Check the form for errors.';
}

export async function createCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const parsed = customerFormSchema.safeParse(parseFormValues(formData));
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const supabase = await createClient();
  let newCustomerId: string;
  try {
    const customer = await createCustomer(supabase, parsed.data as CustomerFormValues);
    newCustomerId = customer.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create customer.' };
  }

  // Outside the try/catch: redirect() throws internally, which must not be
  // caught and reported as a form error.
  revalidatePath('/customers');
  redirect(`/customers/${newCustomerId}`);
}

export async function updateCustomerAction(
  customerId: string,
  _prevState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const parsed = customerFormSchema.safeParse(parseFormValues(formData));
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const supabase = await createClient();
  try {
    await updateCustomer(supabase, customerId, parsed.data as CustomerFormValues);
    revalidatePath('/customers');
    revalidatePath(`/customers/${customerId}`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update customer.' };
  }
  return { error: null };
}

export async function setCustomerStatusAction(customerId: string, status: 'active' | 'inactive') {
  const supabase = await createClient();
  await setCustomerStatus(supabase, customerId, status);
  revalidatePath('/customers');
  revalidatePath(`/customers/${customerId}`);
}

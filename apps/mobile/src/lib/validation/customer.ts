import { z } from 'zod';

// Indian mobile numbers: optional +country code, 10-13 digits overall.
// Mirrors the `customers_mobile_number_format` check constraint in
// supabase/migrations/20261028082301_stage2_schema.sql — keep both in sync.
const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,13}$/, 'Enter a valid mobile number (10–13 digits, optional +country code)');

export const customerFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the customer’s full name'),
  mobileNumber: mobileNumberSchema,
  email: z
    .union([z.string().trim().email('Enter a valid email address'), z.literal('')])
    .optional(),
  address: z.string().trim().min(5, 'Enter a delivery address'),
  locality: z.string().trim().optional(),
  landmark: z.string().trim().optional(),
  assignedWorkerId: z.string().uuid().nullable().optional(),
  routeId: z.string().uuid().nullable().optional(),
  routeSequence: z.number().int().positive().nullable().optional(),
  defaultDailyQuantityMl: z
    .number({ message: 'Enter the daily quantity' })
    .int('Quantity must be a whole number of millilitres')
    .positive('Quantity must be greater than zero'),
  milkTypeId: z.string().uuid('Select a milk type'),
  preferredDeliveryWindow: z.string().trim().optional(),
  deliveryStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  notes: z.string().trim().optional(),
  billingContactName: z.string().trim().optional(),
  billingContactPhone: z.union([mobileNumberSchema, z.literal('')]).optional(),
  accountReference: z.string().trim().optional(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

/** Common quantities a dairy delivers — 250ml steps up to 2L, per the product brief. */
export const QUICK_QUANTITIES_ML = [250, 500, 750, 1000, 1500, 2000] as const;

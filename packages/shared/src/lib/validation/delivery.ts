import { z } from 'zod';

export const DELIVERY_STATUS_OPTIONS = [
  { value: 'completed', label: 'Delivered' },
  { value: 'partial', label: 'Partial' },
  { value: 'missed', label: 'Missed' },
] as const;

// Mirrors the `deliveries_reason_required_unless_completed` check constraint
// in supabase/migrations/20261028090000_stage3_schema.sql — keep both in sync.
export const deliveryEntrySchema = z
  .object({
    status: z.enum(['completed', 'partial', 'missed']),
    deliveredQuantityMl: z
      .number({ message: 'Enter the quantity delivered' })
      .int('Quantity must be a whole number of millilitres')
      .min(0, 'Quantity cannot be negative'),
    reason: z.string().trim().optional(),
  })
  .refine((value) => value.status === 'completed' || !!value.reason, {
    message: 'Enter a reason for a partial or missed delivery',
    path: ['reason'],
  });

export type DeliveryEntryValues = z.infer<typeof deliveryEntrySchema>;

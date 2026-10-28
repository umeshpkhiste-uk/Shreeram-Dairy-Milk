import { z } from 'zod';

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
] as const;

export const paymentFormSchema = z.object({
  amountRupees: z.string().refine((v) => /^\d+(\.\d{1,2})?$/.test(v.trim()) && Number(v) > 0, {
    message: 'Enter an amount greater than zero',
  }),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'other']),
  methodDetail: z.string().trim().optional(),
  transactionReference: z.string().trim().optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  notes: z.string().trim().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

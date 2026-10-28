import { z } from 'zod';

export const billAdjustmentSchema = z.object({
  amountRupees: z.string().refine((v) => /^-?\d+(\.\d{1,2})?$/.test(v.trim()), {
    message: 'Enter an amount, e.g. 50 or -50 for a discount',
  }),
  reason: z.string().trim().min(3, 'Enter a reason for this adjustment'),
});

export type BillAdjustmentFormValues = z.infer<typeof billAdjustmentSchema>;

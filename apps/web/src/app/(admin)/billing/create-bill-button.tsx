'use client';

import { useClickGuard } from '@/lib/use-click-guard';

/**
 * A plain `<button type="submit">` in a server form has no pending state at
 * all, so two fast clicks could submit `createDraftBillAction` twice before
 * the redirect lands — the second would 500 on the
 * monthly_bills_customer_month_active_idx unique violation. Same guard as
 * PrimaryButton/SecondaryButton/DangerButton (components/ui.tsx), kept as
 * its own tiny component here since this one link-styled button isn't a
 * good fit for those components' button styling.
 */
export function CreateBillButton() {
  const guardedOnClick = useClickGuard<React.MouseEvent<HTMLButtonElement>>();
  return (
    <button type="submit" onClick={guardedOnClick} className="font-medium text-primary hover:underline">
      Create bill
    </button>
  );
}

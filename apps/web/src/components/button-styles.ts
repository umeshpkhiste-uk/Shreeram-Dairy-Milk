/**
 * What each button colour means, everywhere on the admin site. Kept out of
 * buttons.tsx (a client module) so server pages can style links with it too.
 */
const TONES = {
  /** Green: saves, adds, confirms or moves forward. */
  primary: 'bg-primary text-text-on-primary hover:bg-primary-hover',
  /** Blue: opens, prints, filters or recalculates; nothing is committed. */
  info: 'bg-info text-text-on-primary hover:opacity-90',
  /** Amber: needs thought, but can be reversed. */
  warning: 'bg-warning text-text-on-primary hover:opacity-90',
  /** Red: cancels, voids or deletes. */
  danger: 'bg-danger text-text-on-primary hover:opacity-90',
  /** Plain: back, close, choose, move between months. */
  secondary: 'border border-border text-text hover:bg-surface-muted',
};

export type ButtonTone = keyof typeof TONES;

export function buttonClass(tone: ButtonTone) {
  return `w-fit shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${TONES[tone]}`;
}

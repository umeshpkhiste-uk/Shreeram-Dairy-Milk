/**
 * The dealer name, tagline, and address — the content half of the fixed top
 * bar (see admin-shell.tsx, which lays this out next to the hamburger
 * column and resizes it as the sidebar opens/collapses).
 */
export function AdminHeaderContent({
  businessName,
  tagline,
  address,
}: {
  businessName: string;
  tagline: string | null;
  address: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- static public asset, no optimization needed */}
      <img src="/logo.png" alt={businessName} width={40} height={40} className="shrink-0 rounded-md" />
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-text">{businessName}</p>
        {tagline ? <p className="truncate text-xs text-text-secondary">{tagline}</p> : null}
        {address ? <p className="truncate text-xs text-text-secondary">{address}</p> : null}
      </div>
    </div>
  );
}

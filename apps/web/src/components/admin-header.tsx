/**
 * The site-wide header: dealer name, tagline, and address, shown above the
 * sidebar on every admin page (sticky, so it stays visible while the page
 * content scrolls). The sidebar itself only shows navigation now — see
 * admin-nav-shell.tsx.
 */
export function AdminHeader({
  businessName,
  tagline,
  address,
}: {
  businessName: string;
  tagline: string | null;
  address: string | null;
}) {
  return (
    <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 md:px-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- static public asset, no optimization needed */}
      <img src="/logo.png" alt={businessName} width={40} height={40} className="shrink-0 rounded-md" />
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-text">{businessName}</p>
        {tagline ? <p className="truncate text-xs text-text-secondary">{tagline}</p> : null}
        {address ? <p className="truncate text-xs text-text-secondary">{address}</p> : null}
      </div>
    </header>
  );
}

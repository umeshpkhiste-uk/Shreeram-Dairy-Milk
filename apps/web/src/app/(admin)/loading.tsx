/** Shown the moment a menu link is clicked, until the page's data arrives. */
export default function Loading() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-48 animate-pulse rounded-md bg-border motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-lg bg-border motion-reduce:animate-none" />
    </div>
  );
}

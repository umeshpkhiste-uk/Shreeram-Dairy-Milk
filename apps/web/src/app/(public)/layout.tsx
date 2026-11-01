import Link from 'next/link';

import { CONTACT_EMAIL } from '@/lib/public-contact';

/** Unauthenticated pages linked from the Google Play listing (see src/proxy.ts PUBLIC_PATHS). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-muted px-4 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-10">
        <header className="mb-8 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- static public asset */}
          <img src="/logo.png" alt="" width={56} height={56} className="h-14 w-14 rounded-full" />
          <div>
            <p className="text-lg font-semibold text-text">Shreeram Doodh Diary &amp; Sweets</p>
            <p className="text-sm text-text-secondary">Quality &amp; Purity are our first priority.</p>
          </div>
        </header>
        <main className="flex flex-col gap-6 text-sm leading-6 text-text [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_a]:text-primary [&_a]:underline">
          {children}
        </main>
        <footer className="mt-10 border-t border-border pt-4 text-xs text-text-secondary [&_a]:underline">
          R9 Sector, Life Republic, Kolte Patil · <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          {' · '}
          <Link href="/privacy">Privacy policy</Link>
          {' · '}
          <Link href="/delete-account">Delete account</Link>
        </footer>
      </div>
    </div>
  );
}

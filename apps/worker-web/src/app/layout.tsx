import { SerwistProvider } from '@serwist/next/react';
import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Shreeram Doodh Diary & Sweets — Worker',
  description: "Delivery workers: today's route, delivery history and sync.",
  manifest: '/manifest.json',
};

export const viewport: Viewport = { themeColor: '#174a30' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {/* reloadOnOnline would reload the page mid-sync the moment signal returns. */}
        <SerwistProvider
          swUrl="/sw.js"
          disable={process.env.NODE_ENV !== 'production'}
          cacheOnNavigation={false}
          reloadOnOnline={false}
        >
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}

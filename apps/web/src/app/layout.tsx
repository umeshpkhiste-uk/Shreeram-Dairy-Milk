import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shreeram Doodh Diary & Sweets — Admin",
  description:
    "Admin console for Shreeram Doodh Diary & Sweets: customers, workers, deliveries, billing, and payments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Applies the saved theme before first paint; see theme-toggle.tsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem('theme')==='dark'?'dark':'light'}catch{}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}

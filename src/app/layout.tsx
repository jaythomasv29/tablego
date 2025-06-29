import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import FloatingContactButton from '@/components/FloatingContactButton';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Thaiphoon Restaurant - Reservations',
  description: 'Make a reservation at our Thaiphoon Restaurant',
};

// Generate a build version for cache busting
const buildVersion = Date.now().toString();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Cache-busting meta tags */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta name="version" content={buildVersion} />

        {/* Prevent Safari from caching */}
        <meta name="apple-mobile-web-app-capable" content="no" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <Analytics />
        {/* <FloatingContactButton /> */}

        {/* Add version info for debugging */}
        <div style={{ display: 'none' }} data-version={buildVersion}></div>
      </body>
    </html>
  );
}
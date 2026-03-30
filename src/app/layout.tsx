import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import FloatingContactButton from '@/components/FloatingContactButton';
import { TimezoneProvider } from '@/contexts/TimezoneContext';

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
        <TimezoneProvider>
          {children}
        </TimezoneProvider>
        <Analytics />
        {/* <FloatingContactButton /> */}

        {/* Add version info for debugging */}
        <div style={{ display: 'none' }} data-version={buildVersion}></div>

        {/* AI Chat Widget */}
        {/* <script src="http://localhost:3000/widget.js?v=1.0.0&id=tmjjAJlygKTkg7BmEDAI" defer></script> */}
        {/* <script src="https://ai-chat-widget.vercel.app/widget.js?v=1.0.0&id=tmjjAJlygKTkg7BmEDAI" defer></script>
        <script src="http://localhost:3000/widget.js?v=1.0.0&id=tmjjAJlygKTkg7BmEDAI" defer></script> */}
        {/* <script src="http://localhost:3000/widget.js?v=1.0.0&id=IJYo7saRD4gdmhkfRvL6" defer></script>
         */}
        {/* AI Chat */}
        <script src="https://ai-chat-q2k1.vercel.app/widget.js?v=1.0.0&id=IJYo7saRD4gdmhkfRvL6" defer></script>

      </body>
    </html>
  );
}
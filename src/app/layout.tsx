import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import FloatingContactButton from '@/components/FloatingContactButton';
import ServiceWorkerProvider from '@/components/ServiceWorkerProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Thaiphoon Restaurant - Reservations',
  description: 'Make a reservation at our Thaiphoon Restaurant',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className={inter.className}>
        <ServiceWorkerProvider>
          {children}
          <Analytics />
          <FloatingContactButton />
        </ServiceWorkerProvider>
      </body>
    </html>
  );
}
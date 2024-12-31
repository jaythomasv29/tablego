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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>

        {children}
        <Analytics />
        <FloatingContactButton />
      </body>
    </html>
  );
}